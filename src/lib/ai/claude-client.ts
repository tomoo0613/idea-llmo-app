import Anthropic from "@anthropic-ai/sdk";
import type { AIResponse } from "./types";
import { extractUrls } from "./url-extractor";

export async function queryClaude(
  apiKey: string,
  prompt: string,
  model: string,
  variantName: string,
  searchEnabled: boolean = false
): Promise<AIResponse> {
  const client = new Anthropic({ apiKey });
  const start = Date.now();

  try {
    let text = "";
    const citedUrls: string[] = [];

    if (searchEnabled) {
      // Web検索ON: web_search ツールを使用（日本ロケーション設定付き）
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 5,
            user_location: {
              type: "approximate",
              country: "JP",
              city: "Tokyo",
              region: "Tokyo",
              timezone: "Asia/Tokyo",
            },
          } as Anthropic.Messages.WebSearchTool20250305,
        ],
      });

      // レスポンスからテキストとURLを抽出
      for (const block of response.content) {
        if (block.type === "text") {
          text += block.text;
          // citationsからURLを取得
          const citations = (block as unknown as Record<string, unknown>).citations;
          if (Array.isArray(citations)) {
            for (const citation of citations) {
              const c = citation as Record<string, unknown>;
              if (typeof c.url === "string" && !citedUrls.includes(c.url)) {
                citedUrls.push(c.url);
              }
            }
          }
        }
      }

      // テキストからもURL抽出して追加
      for (const url of extractUrls(text)) {
        if (!citedUrls.includes(url)) {
          citedUrls.push(url);
        }
      }
    } else {
      // 通常モード（検索なし）
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });

      text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      citedUrls.push(...extractUrls(text));
    }

    return {
      provider: "claude",
      modelVariant: variantName,
      text,
      responseTimeMs: Date.now() - start,
      citedUrls,
    };
  } catch (err) {
    return {
      provider: "claude",
      modelVariant: variantName,
      text: "",
      responseTimeMs: Date.now() - start,
      citedUrls: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
