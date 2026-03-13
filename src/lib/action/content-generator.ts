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

  const prompt = `あなたはLLMO（Large Language Model Optimization）の専門家です。
以下の情報に基づいて、AIの検索結果での表示を改善するためのコンテンツ戦略を提案してください。

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

上記を踏まえて、5個の具体的な対策を、以下のJSON配列形式で出力してください。
各対策は優先度順（priority: 1が最優先）にしてください。

カテゴリは以下から選択:
- content: Webサイトのコンテンツ作成/改善
- faq: FAQ・Q&Aコンテンツ
- structured-data: 構造化データ（schema.org等）
- brand: ブランド言及・権威性向上
- seo: SEO対策

重要: 必ず正しいJSON配列のみを出力してください。文字列中にダブルクォートを使わないでください。

[
  {
    "priority": 1,
    "category": "content",
    "title": "対策のタイトル",
    "description": "具体的に何をすべきか（100文字以内）",
    "rationale": "なぜこの対策がAI表示に効果的か（100文字以内）",
    "suggestedContent": "実際に作成すべきコンテンツのドラフト（200文字程度）",
    "targetPrompts": ["関連するキーワード1", "関連するキーワード2"]
  }
]`;

  const response = await client.messages.create({
    model: "claude-3-5-haiku-20241022",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return safeParseJSON(text);
}
