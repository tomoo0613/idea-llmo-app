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

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000; // 5秒

/** 検索ONのモデルは3回試行、検索OFFは1回 */
const SEARCH_ATTEMPT_COUNT = 3;

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

    // エラーなし or リトライ不可のエラー → 即返す
    if (!response.error || !isRetryableError(response.error)) {
      return response;
    }

    // リトライ可能エラー: 最後の試行でなければ待ってからリトライ
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * (attempt + 1);
      console.log(
        `[Survey] ${variant.variantName}: レート制限エラー、${delay / 1000}秒後にリトライ (${attempt + 1}/${MAX_RETRIES})`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    } else {
      return response;
    }
  }
  return null;
}

/**
 * 検索ONモデルに対して複数回クエリを実行し、結果を集約する
 * - サービス言及: OR論理（1回でも言及されれば◯）
 * - 引用URL: 全試行のユニオン
 * - レスポンステキスト: 最も長い回答を採用
 */
async function queryMultiAttempt(
  variant: ModelVariant,
  prompt: string,
  keys: { openai: string | null; gemini: string | null; claude: string | null },
  attemptCount: number
): Promise<AIResponse | null> {
  const responses: AIResponse[] = [];

  for (let i = 0; i < attemptCount; i++) {
    if (i > 0) {
      // 試行間の待機（レート制限回避）
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    console.log(`[Survey] ${variant.variantName}: 試行 ${i + 1}/${attemptCount}`);
    const response = await queryWithRetry(variant, prompt, keys);
    if (response && !response.error) {
      responses.push(response);
    }
  }

  if (responses.length === 0) {
    // 全試行失敗 → 最後のエラーレスポンスを返す
    const lastAttempt = await queryWithRetry(variant, prompt, keys);
    return lastAttempt;
  }

  // 集約: 最も長いテキストを採用
  const bestResponse = responses.reduce((best, r) =>
    r.text.length > best.text.length ? r : best
  );

  // 全試行のURLを統合
  const allUrls: string[] = [];
  for (const r of responses) {
    for (const url of r.citedUrls) {
      if (!allUrls.includes(url)) {
        allUrls.push(url);
      }
    }
  }

  // 全試行のテキストを結合してサービス言及チェックに使用
  const combinedText = responses.map((r) => r.text).join("\n\n---\n\n");

  return {
    provider: bestResponse.provider,
    modelVariant: bestResponse.modelVariant,
    text: bestResponse.text,
    responseTimeMs: Math.round(
      responses.reduce((sum, r) => sum + r.responseTimeMs, 0) / responses.length
    ),
    citedUrls: allUrls,
    // combinedText を _combinedText として渡す（サービスチェック用）
    _combinedText: combinedText,
  } as AIResponse & { _combinedText?: string };
}

/** プロンプト文字列を改行で分割し、空行を除外 */
function splitPrompts(promptText: string): string[] {
  return promptText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export async function executeSurvey(config: SurveyConfig) {
  const {
    surveyId, prompt, targetDomain, targetServices,
    openaiApiKey, geminiApiKey, claudeApiKey,
  } = config;

  const keys = { openai: openaiApiKey, gemini: geminiApiKey, claude: claudeApiKey };

  // プロンプトを改行で分割
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

  // totalSteps = プロンプト数 × モデル数
  const totalSteps = prompts.length * activeVariants.length;

  await prisma.survey.update({
    where: { id: surveyId },
    data: { status: "running", startedAt: new Date(), totalSteps },
  });

  try {
    for (let pIdx = 0; pIdx < prompts.length; pIdx++) {
      const currentPrompt = prompts[pIdx];
      console.log(`[Survey] プロンプト ${pIdx + 1}/${prompts.length}: "${currentPrompt.slice(0, 50)}..."`);

      for (const variant of activeVariants) {
        // 検索ONモデルは複数回試行、検索OFFは1回
        const attemptCount = variant.searchEnabled ? SEARCH_ATTEMPT_COUNT : 1;

        let response: (AIResponse & { _combinedText?: string }) | null;
        if (attemptCount > 1) {
          response = await queryMultiAttempt(variant, currentPrompt, keys, attemptCount);
        } else {
          response = await queryWithRetry(variant, currentPrompt, keys);
        }

        if (response) {
          // サービス言及チェック（複数試行の場合は結合テキストで判定）
          const textForCheck = response._combinedText || response.text;
          const serviceMentions: Record<string, boolean> = {};
          for (const svc of targetServices) {
            serviceMentions[svc] = response.error
              ? false
              : checkServiceMention(textForCheck, svc);
          }

          // ドメイン引用チェック（全試行のURL統合済み）
          const domainCited = response.error
            ? false
            : checkDomainCited(response.citedUrls, targetDomain);

          await prisma.surveyResult.create({
            data: {
              surveyId,
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

        // 進捗更新
        await prisma.survey.update({
          where: { id: surveyId },
          data: { doneSteps: { increment: 1 } },
        });

        // レート制限回避（バリアント間の待機）
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

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
