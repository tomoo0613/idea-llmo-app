export type AIProvider = "openai" | "gemini" | "claude";

// 1つのAIモデルバリアント
export interface ModelVariant {
  variantName: string;     // 表示名
  provider: AIProvider;
  modelId: string;         // APIモデルID
  searchEnabled: boolean;  // Web検索ON/OFF
}

// 全モデルバリアントの定義（競合ツール同等構成）
export const MODEL_VARIANTS: ModelVariant[] = [
  // OpenAI — GPT-5.2 Thinking (推論あり) & Instant (高速)
  { variantName: "GPT-5.2 Thinking",           provider: "openai", modelId: "gpt-5.2",       searchEnabled: false },
  { variantName: "GPT-5.2 Thinking｜検索ON",    provider: "openai", modelId: "gpt-5.2",       searchEnabled: true },
  { variantName: "GPT-5.2 Instant",            provider: "openai", modelId: "gpt-5-mini",    searchEnabled: false },
  { variantName: "GPT-5.2 Instant｜検索ON",     provider: "openai", modelId: "gpt-5-mini",    searchEnabled: true },
  // Gemini — Gemini 3 Thinking (Pro) & Fast (Flash)
  { variantName: "Gemini 3 Thinking",           provider: "gemini", modelId: "gemini-3-flash-preview", searchEnabled: false },
  { variantName: "Gemini 3 Thinking｜検索ON",    provider: "gemini", modelId: "gemini-3-flash-preview", searchEnabled: true },
  { variantName: "Gemini 3 Fast",               provider: "gemini", modelId: "gemini-3.1-flash-lite-preview", searchEnabled: false },
  { variantName: "Gemini 3 Fast｜検索ON",        provider: "gemini", modelId: "gemini-3.1-flash-lite-preview", searchEnabled: true },
  // Claude
  { variantName: "Claude Sonnet 4",             provider: "claude", modelId: "claude-sonnet-4-5-20250929", searchEnabled: false },
  { variantName: "Claude Sonnet 4｜検索ON",      provider: "claude", modelId: "claude-sonnet-4-5-20250929", searchEnabled: true },
];

export interface AIResponse {
  provider: AIProvider;
  modelVariant: string;
  text: string;
  responseTimeMs: number;
  citedUrls: string[];   // レスポンス中の全URL
  error?: string;
}
