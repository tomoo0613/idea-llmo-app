import { GoogleGenAI } from "@google/genai";
import type { AIResponse } from "./types";
import { extractUrls } from "./url-extractor";

export async function queryGemini(
  apiKey: string,
  prompt: string,
  model: string,
  variantName: string,
  searchEnabled: boolean
): Promise<AIResponse> {
  const ai = new GoogleGenAI({ apiKey });
  const start = Date.now();

  try {
    const response = searchEnabled
      ? await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
          },
        })
      : await ai.models.generateContent({
          model,
          contents: prompt,
        });

    const text = response.text ?? "";

    // Grounding結果からURLも取得
    const urls = extractUrls(text);

    // groundingMetadataからも引用URLを取得
    const candidate = response.candidates?.[0];
    if (candidate?.groundingMetadata?.groundingChunks) {
      for (const chunk of candidate.groundingMetadata.groundingChunks) {
        if (chunk.web?.uri && !urls.includes(chunk.web.uri)) {
          urls.push(chunk.web.uri);
        }
      }
    }

    return {
      provider: "gemini",
      modelVariant: variantName,
      text,
      responseTimeMs: Date.now() - start,
      citedUrls: urls,
    };
  } catch (err) {
    return {
      provider: "gemini",
      modelVariant: variantName,
      text: "",
      responseTimeMs: Date.now() - start,
      citedUrls: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
