import { prisma } from "@/lib/prisma";
import { queryOpenAI } from "./openai-client";
import { queryGemini } from "./gemini-client";
import { queryClaude } from "./claude-client";
import { checkServiceMention, checkDomainCited } from "./url-extractor";
import { MODEL_VARIANTS, type ModelVariant, type AIResponse } from "./types";

interface SurveyConfig {
  surveyId: string;
  projectId: string;
  prompt: string;
  targetDomain: string;
  targetServices: string[];
  openaiApiKey: string | null;
  geminiApiKey: string | null;
  claudeApiKey: string | null;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;

/** 検索ONのモデルは2回試行（並列実行） */
const SEARCH_ATTEMPT_COUNT = 2;

/** 同一プロバイダーへの同時リクエスト上限 */
const MAX_CONCURRENT_PER_PROVIDER = 3;

/** プロンプト同時実行数 */
const MAX_CONCURRENT_PROMPTS = 3;

// ──────────────────── ユーティリティ ────────────────────

/** 並行数制限付きセマフォ */
class Semaphore {
  private queue: (() => void)[] = [];
  private current = 0;
  constructor(private max: number) {}
  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.current++;
        resolve();
      });
    });
  }
  release(): void {
    this.current--;
    const next = this.queue.shift();
    if (next) next();
  }
}

// プロバイダー別セマフォ（API レート制限回避）
const providerSemaphores: Record<string, Semaphore> = {
  openai: new Semaphore(MAX_CONCURRENT_PER_PROVIDER),
  gemini: new Semaphore(MAX_CONCURRENT_PER_PROVIDER),
  claude: new Semaphore(MAX_CONCURRENT_PER_PROVIDER),
};

// ──────────────────── AI クエリ ────────────────────

async function queryVariant(
  variant: ModelVariant,
  prompt: string,
  keys: { openai: string | null; gemini: string | null; claude: string | null }
): Promise<AIResponse | null> {
  switch (variant.provider) {
    case "openai":
      if (!keys.openai) return null;
      return queryOpenAI(keys.openai, prompt, variant.modelId, variant.variantName, variant.searchEnabled);
    case "gemini":
      if (!keys.gemini) return null;
      return queryGemini(keys.gemini, prompt, variant.modelId, variant.variantName, variant.searchEnabled);
    case "claude":
      if (!keys.claude) return null;
      return queryClaude(keys.claude, prompt, variant.modelId, variant.variantName, variant.searchEnabled);
    default:
      return null;
  }
}

function isRetryableError(error: string): boolean {
  const lower = error.toLowerCase();
  return (
    lower.includes("429") ||
    lower.includes("rate") ||
    lower.includes("quota") ||
    lower.includes("too many") ||
    lower.includes("overloaded") ||
    lower.includes("503") ||
    lower.includes("timeout")
  );
}

async function queryWithRetry(
  variant: ModelVariant,
  prompt: string,
  keys: { openai: string | null; gemini: string | null; claude: string | null }
): Promise<AIResponse | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await queryVariant(variant, prompt, keys);
    if (!response) return null;
    if (!response.error || !isRetryableError(response.error)) return response;
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * (attempt + 1);
      console.log(`[Survey] ${variant.variantName}: レート制限→${delay / 1000}秒後リトライ (${attempt + 1}/${MAX_RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    } else {
      return response;
    }
  }
  return null;
}

// ──────────────────── 検索試行（★並列化） ────────────────────

/**
 * 検索ONモデルに対して複数回クエリを **並列** 実行し、結果を集約する
 * - 3回の試行を同時に走らせ、待機時間をゼロに
 */
async function queryMultiAttemptParallel(
  variant: ModelVariant,
  prompt: string,
  keys: { openai: string | null; gemini: string | null; claude: string | null },
  attemptCount: number
): Promise<(AIResponse & { _combinedText?: string }) | null> {
  console.log(`[Survey] ${variant.variantName}: ${attemptCount}回並列試行開始`);

  // ★ 全試行を並列実行
  const results = await Promise.allSettled(
    Array.from({ length: attemptCount }, (_, i) => {
      // 少しだけオフセット（同一エンドポイントの瞬間的衝突回避: 0, 200ms, 400ms）
      return new Promise<AIResponse | null>((resolve) =>
        setTimeout(
          () => queryWithRetry(variant, prompt, keys).then(resolve),
          i * 200
        )
      );
    })
  );

  const responses: AIResponse[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value && !r.value.error) {
      responses.push(r.value);
    }
  }

  if (responses.length === 0) {
    // 全試行失敗 → 最初のエラーを返す
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) return r.value;
    }
    return null;
  }

  // 集約: 最も長いテキストを採用
  const bestResponse = responses.reduce((best, r) =>
    r.text.length > best.text.length ? r : best
  );

  // 全試行のURLを統合
  const allUrls: string[] = [];
  for (const r of responses) {
    for (const url of r.citedUrls) {
      if (!allUrls.includes(url)) allUrls.push(url);
    }
  }

  const combinedText = responses.map((r) => r.text).join("\n\n---\n\n");

  return {
    provider: bestResponse.provider,
    modelVariant: bestResponse.modelVariant,
    text: bestResponse.text,
    responseTimeMs: Math.round(
      responses.reduce((sum, r) => sum + r.responseTimeMs, 0) / responses.length
    ),
    citedUrls: allUrls,
    _combinedText: combinedText,
  } as AIResponse & { _combinedText?: string };
}

// ──────────────────── 単一バリアント実行 ────────────────────

/**
 * 1つのバリアントを実行し、結果をDBに保存する
 * プロバイダー別セマフォで同時接続数を制限
 */
async function executeSingleVariant(
  variant: ModelVariant,
  currentPrompt: string,
  pIdx: number,
  keys: { openai: string | null; gemini: string | null; claude: string | null },
  config: { surveyId: string; targetDomain: string; targetServices: string[] },
  onStepDone: () => Promise<void>
): Promise<void> {
  const sem = providerSemaphores[variant.provider];
  await sem.acquire();

  try {
    const attemptCount = variant.searchEnabled ? SEARCH_ATTEMPT_COUNT : 1;

    let response: (AIResponse & { _combinedText?: string }) | null;
    if (attemptCount > 1) {
      response = await queryMultiAttemptParallel(variant, currentPrompt, keys, attemptCount);
    } else {
      response = await queryWithRetry(variant, currentPrompt, keys);
    }

    if (response) {
      const textForCheck = response._combinedText || response.text;
      const serviceMentions: Record<string, boolean> = {};
      for (const svc of config.targetServices) {
        serviceMentions[svc] = response.error ? false : checkServiceMention(textForCheck, svc);
      }
      const domainCited = response.error
        ? false
        : checkDomainCited(response.citedUrls, config.targetDomain);

      await prisma.surveyResult.create({
        data: {
          surveyId: config.surveyId,
          promptIndex: pIdx,
          promptText: currentPrompt,
          modelVariant: variant.variantName,
          provider: variant.provider,
          modelId: variant.modelId,
          searchEnabled: variant.searchEnabled,
          responseText: response.text,
          responseTimeMs: response.responseTimeMs,
          serviceMentions: JSON.stringify(serviceMentions),
          targetDomainCited: domainCited,
          citedUrls: JSON.stringify(response.citedUrls),
          error: response.error || null,
        },
      });
    }

    await onStepDone();
  } finally {
    sem.release();
  }
}

// ──────────────────── プロンプト分割 ────────────────────

function splitPrompts(promptText: string): string[] {
  return promptText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// ──────────────────── 並列実行コントローラー ────────────────────

/**
 * 配列を指定並行数で処理する汎用関数
 */
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const executing: Promise<void>[] = [];
  for (const item of items) {
    const p = fn(item).then(() => {
      executing.splice(executing.indexOf(p), 1);
    });
    executing.push(p);
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}

// ──────────────────── メインエントリ ────────────────────

export async function executeSurvey(config: SurveyConfig) {
  const {
    surveyId, prompt, targetDomain, targetServices,
    openaiApiKey, geminiApiKey, claudeApiKey,
  } = config;

  const keys = { openai: openaiApiKey, gemini: geminiApiKey, claude: claudeApiKey };

  const prompts = splitPrompts(prompt);
  if (prompts.length === 0) {
    await prisma.survey.update({
      where: { id: surveyId },
      data: { status: "failed", completedAt: new Date() },
    });
    return;
  }

  // 使用可能なバリアントをフィルタ
  const activeVariants = MODEL_VARIANTS.filter((v) => {
    if (v.provider === "openai" && !keys.openai) return false;
    if (v.provider === "gemini" && !keys.gemini) return false;
    if (v.provider === "claude" && !keys.claude) return false;
    return true;
  });

  const totalSteps = prompts.length * activeVariants.length;

  await prisma.survey.update({
    where: { id: surveyId },
    data: { status: "running", startedAt: new Date(), totalSteps },
  });

  const onStepDone = async () => {
    await prisma.survey.update({
      where: { id: surveyId },
      data: { doneSteps: { increment: 1 } },
    });
  };

  try {
    // ★ 複数プロンプトを同時実行（MAX_CONCURRENT_PROMPTS 並列）
    await runWithConcurrency(
      prompts.map((p, i) => ({ prompt: p, idx: i })),
      MAX_CONCURRENT_PROMPTS,
      async ({ prompt: currentPrompt, idx: pIdx }) => {
        console.log(`[Survey] プロンプト ${pIdx + 1}/${prompts.length}: "${currentPrompt.slice(0, 50)}..."`);

        // ★ 全バリアントを同時並列実行
        // プロバイダー別セマフォで自動的に同時接続数を制限
        await Promise.allSettled(
          activeVariants.map((variant) =>
            executeSingleVariant(
              variant,
              currentPrompt,
              pIdx,
              keys,
              { surveyId, targetDomain, targetServices },
              onStepDone
            )
          )
        );

        console.log(`[Survey] プロンプト ${pIdx + 1}/${prompts.length} 完了`);
      }
    );

    await prisma.survey.update({
      where: { id: surveyId },
      data: { status: "completed", completedAt: new Date() },
    });
  } catch (err) {
    await prisma.survey.update({
      where: { id: surveyId },
      data: { status: "failed", completedAt: new Date() },
    });
    console.error("Survey execution error:", err);
  }
}
