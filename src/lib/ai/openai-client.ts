import OpenAI from "openai";
import type { AIResponse } from "./types";
import { extractUrls } from "./url-extractor";

// 日本ロケーション設定（Responses API用 - フラット構造）
const RESPONSES_USER_LOCATION = {
  type: "approximate" as const,
  country: "JP",
  city: "Tokyo",
  region: "Tokyo",
  timezone: "Asia/Tokyo",
};

/** utm_source=openai パラメータを除去 */
function cleanOpenAIUrl(url: string): string {
  return url.replace(/[?&]utm_source=openai\b/, "").replace(/\?$/, "");
}

export async function queryOpenAI(
  apiKey: string,
  prompt: string,
  model: string,
  variantName: string,
  searchEnabled: boolean
): Promise<AIResponse> {
  const client = new OpenAI({ apiKey });
  const start = Date.now();

  try {
    let text = "";
    const citedUrls: string[] = [];

    if (searchEnabled) {
      // Responses API でWeb検索 (全モデル共通)
      // tool_choice: "required" でGPT-5.2等の推論モデルでも検索を強制
      const response = await client.responses.create({
        model,
        tools: [{
          type: "web_search_preview" as const,
          search_context_size: "high" as const,
          user_location: RESPONSES_USER_LOCATION,
        }],
        tool_choice: "required",
        input: prompt,
      });
      // outputからテキストと引用URLを抽出
      if (response.output) {
        for (const item of response.output) {
          if (item.type === "message" && item.content) {
            for (const block of item.content) {
              if (block.type === "output_text") {
                text += block.text;
                // annotationsから引用URLを取得
                if (block.annotations) {
                  for (const ann of block.annotations) {
                    if (ann.type === "url_citation" && ann.url) {
                      const cleanUrl = cleanOpenAIUrl(ann.url);
                      if (!citedUrls.includes(cleanUrl)) {
                        citedUrls.push(cleanUrl);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      if (!text) {
        text = typeof response.output === "string" ? response.output : JSON.stringify(response.output);
      }

      // テキストからもURL抽出して追加
      for (const url of extractUrls(text)) {
        const cleanUrl = cleanOpenAIUrl(url);
        if (!citedUrls.includes(cleanUrl)) {
          citedUrls.push(cleanUrl);
        }
      }
    } else {
      // 通常モード（検索なし）- Chat Completions API
      // GPT-5.2系は max_tokens ではなく max_completion_tokens を使用
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 16384,
      });
      text = response.choices[0]?.message?.content ?? "";
      citedUrls.push(...extractUrls(text));
    }

    return {
      provider: "openai",
      modelVariant: variantName,
      text,
      responseTimeMs: Date.now() - start,
      citedUrls,
    };
  } catch (err) {
    return {
      provider: "openai",
      modelVariant: variantName,
      text: "",
      responseTimeMs: Date.now() - start,
      citedUrls: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
