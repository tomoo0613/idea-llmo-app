import Anthropic from "@anthropic-ai/sdk";

interface GenerateInput {
  targetDomain: string;
  targetServices: string[];
  targetCustomer: string;
  ruleMaking: string;
  overallScore: number;
  weaknesses: string[];
  keywordCoverage: number;
  citationRate: number;
  weakServices: string[];
}

export interface RecommendationInput {
  priority: number;
  category: string;
  title: string;
  description: string;
  rationale: string;
  suggestedContent: string;
  targetPrompts: string[];
}

/** JSON文字列を安全にパースする（不正な末尾カンマ等を修正） */
function safeParseJSON(text: string): RecommendationInput[] {
  // コードブロックを除去
  let json = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
  // JSON配列部分のみを抽出
  const match = json.match(/\[[\s\S]*\]/);
  if (!match) {
    throw new Error("JSON配列が見つかりませんでした");
  }
  json = match[0];

  // 不正な末尾カンマを除去 (], の前の , を除去)
  json = json.replace(/,\s*([}\]])/g, "$1");

  // 制御文字を除去（改行以外）
  json = json.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");

  try {
    return JSON.parse(json) as RecommendationInput[];
  } catch (firstError) {
    // 2回目: 文字列内のエスケープされていない改行を修正
    try {
      json = json.replace(/(?<=: "(?:[^"\\]|\\.)*)[\n\r]+(?=(?:[^"\\]|\\.)*")/g, "\\n");
      return JSON.parse(json) as RecommendationInput[];
    } catch {
      console.error("JSON parse error:", firstError);
      console.error("Raw text (first 500):", text.substring(0, 500));
      throw new Error(`AIからの応答をパースできませんでした: ${firstError instanceof Error ? firstError.message : String(firstError)}`);
    }
  }
}

export async function generateRecommendations(
  input: GenerateInput,
  apiKey: string
): Promise<RecommendationInput[]> {
  const client = new Anthropic({ apiKey });

  const prompt = `あなたはLLMO（Large Language Model Optimization）とデジタルPRの専門家です。
以下の分析結果に基づいて、対話型AIから推薦される企業になるための具体的なコンテンツ戦略を提案してください。

## 重要な前提：IDEAコンテンツ方法論
対策は必ず以下の3ステップに基づいて提案すること：

**STEP 1: 調査で数字を作る（リサピー®）**
- ターゲット顧客層に対してインターネット調査（リサピー）を実施
- 業界課題を定量データで可視化し、AIが引用しやすい一次データを創出
- 調査テーマは「顧客が知りたい」×「企業が伝えたい」を繋ぐものにする

**STEP 2: 第三者メディアに置く（プレスリリース配信・メディア掲載）**
- 調査データをプレスリリース（PR TIMES等）で配信
- 業界専門メディアへの寄稿・取材誘致でメディア露出を獲得
- AIの引用リンクの約89%は第三者メディア情報であり、第三者ドメインからの言及が最重要

**STEP 3: 自社サイトのE-E-A-T強化（コンテンツ二次活用）**
- ホワイトペーパー、ガイドブック、コラム等に調査データを二次活用
- 構造化データ（Schema.org）でAIに参照されやすい構造にする
- FAQ・Q&A形式でAIが回答生成時に引用しやすい形にする

## 対象ドメイン
${input.targetDomain || "未設定"}

## 調査テキスト言及（AIに言及されたいキーワード）
${input.targetServices.join("、") || "未設定"}

## ターゲット顧客
${input.targetCustomer || "未設定"}

## ルールメイク（どのような形で選ばれたいか）
${input.ruleMaking || "未設定"}

## 現在の分析結果
- 総合スコア: ${input.overallScore.toFixed(0)}/100
- テキスト言及率: ${(input.keywordCoverage * 100).toFixed(0)}%
- ドメイン引用率: ${(input.citationRate * 100).toFixed(0)}%

## 弱み（改善が必要な領域）
${input.weaknesses.length > 0 ? input.weaknesses.join("\n") : "特になし"}

## AI検索で言及が少ないキーワード
${input.weakServices.length > 0 ? input.weakServices.join("、") : "なし"}

上記を踏まえて、5個の具体的な対策を以下のJSON配列形式で出力してください。
各対策は優先度順（priority: 1が最優先）にしてください。

**提案のルール:**
- 必ずリサピー（ターゲット顧客への調査）を起点とした提案を含めること
- プレスリリース配信→メディア掲載→AIからの引用という流れを意識すること
- 各提案にはターゲット顧客の課題に寄り添った具体的な調査テーマを含めること
- suggestedContentには、調査リリースのタイトル案や調査設問のイメージを含めること

カテゴリは以下から選択:
- research-pr: リサピー®（調査PR）- ターゲット顧客への調査→プレスリリース配信→メディア掲載
- whitepaper: ハクピー®（ソートリーダーシップ）- 業界白書・総括レポートで権威性確立
- report: レポピー®（レポートマーケティング）- 課題解決型ガイドブック・レポート
- column: コラピー®（コラムマーケティング）- E-E-A-T準拠のファクト中心コラム
- structured-data: 構造化データ・サイト最適化 - Schema.org/FAQ構造化

重要: 必ず正しいJSON配列のみを出力してください。文字列中にダブルクォートを使わないでください。

[
  {
    "priority": 1,
    "category": "research-pr",
    "title": "対策のタイトル",
    "description": "具体的に何をすべきか（調査テーマ・対象者・配信先を含む）",
    "rationale": "なぜこの対策がAI表示に効果的か（第三者メディア掲載によるAI引用の仕組みを含む）",
    "suggestedContent": "調査リリースのタイトル案、調査設問イメージ、想定メディア掲載先を含むドラフト（200文字程度）",
    "targetPrompts": ["この対策で狙うAI検索プロンプト1", "狙うプロンプト2"]
  }
]`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return safeParseJSON(text);
}
