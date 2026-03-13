import * as XLSX from "xlsx";
import { extractDomain, urlToDisplayPath } from "./ai/url-extractor";

interface SurveyResultData {
  promptIndex: number;
  promptText: string;
  modelVariant: string;
  provider: string;
  searchEnabled: boolean;
  serviceMentions: string; // JSON
  targetDomainCited: boolean;
  citedUrls: string; // JSON
  error: string | null;
}

interface ExportConfig {
  prompt: string;
  targetDomain: string;
  targetServices: string[];
  results: SurveyResultData[];
}

function hasError(r: SurveyResultData): boolean {
  return r.error !== null && r.error !== undefined && r.error.length > 0;
}

/** プロンプトごとにグループ化 */
function groupByPrompt(results: SurveyResultData[]): Map<number, { promptText: string; results: SurveyResultData[] }> {
  const groups = new Map<number, { promptText: string; results: SurveyResultData[] }>();
  for (const r of results) {
    const idx = r.promptIndex ?? 0;
    if (!groups.has(idx)) {
      groups.set(idx, { promptText: r.promptText || "", results: [] });
    }
    groups.get(idx)!.results.push(r);
  }
  return groups;
}

export function generateExcel(config: ExportConfig): Buffer {
  const { prompt, targetDomain, targetServices, results } = config;
  const wb = XLSX.utils.book_new();

  const promptGroups = groupByPrompt(results);
  const sortedGroups = Array.from(promptGroups.entries()).sort(([a], [b]) => a - b);

  // === Sheet 1: 調査内容 ===
  const prompts = prompt.split(/\r?\n/).filter((l) => l.trim());
  const sheet1Data: (string | number)[][] = [
    ["プロンプト数", prompts.length],
    [],
  ];
  prompts.forEach((p, i) => {
    sheet1Data.push([`プロンプト ${i + 1}`, p.trim()]);
  });
  sheet1Data.push([], ["調査対象サイト", targetDomain], []);
  sheet1Data.push(["調査テキスト言及", ...targetServices.slice(0, 1)]);
  for (let i = 1; i < targetServices.length; i++) {
    sheet1Data.push(["", targetServices[i]]);
  }
  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  ws1["!cols"] = [{ wch: 18 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ws1, "調査内容");

  // === Sheet 2: サービスの言及状況（プロンプト別） ===
  {
    const sheetData: (string | number)[][] = [];

    for (const [pIdx, group] of sortedGroups) {
      const variantNames = group.results.map((r) => r.modelVariant);

      // プロンプトヘッダー
      sheetData.push([`プロンプト ${pIdx + 1}: ${group.promptText}`]);
      sheetData.push(["調査テキスト言及", ...variantNames]);

      for (const svc of targetServices) {
        const row: string[] = [svc];
        for (const r of group.results) {
          if (hasError(r)) {
            row.push("ERR");
          } else {
            const mentions: Record<string, boolean> = JSON.parse(r.serviceMentions);
            row.push(mentions[svc] ? "◯" : "×");
          }
        }
        sheetData.push(row);
      }

      // ドメイン引用行
      const domainRow: string[] = [`${targetDomain} (引用)`];
      for (const r of group.results) {
        if (hasError(r)) {
          domainRow.push("ERR");
        } else {
          domainRow.push(r.targetDomainCited ? "◯" : "×");
        }
      }
      sheetData.push(domainRow);
      sheetData.push([]); // 空行
    }

    const ws2 = XLSX.utils.aoa_to_sheet(sheetData);
    ws2["!cols"] = [{ wch: 18 }, ...Array.from({ length: 15 }, () => ({ wch: 22 }))];
    XLSX.utils.book_append_sheet(wb, ws2, "テキスト言及状況");
  }

  // === Sheet 3: 引用ページ（ドメイン別・プロンプト別）===
  {
    const sheetData: string[][] = [];

    for (const [pIdx, group] of sortedGroups) {
      const variantNames = group.results.map((r) => r.modelVariant);
      sheetData.push([`プロンプト ${pIdx + 1}: ${group.promptText}`]);
      sheetData.push(["引用ドメイン", ...variantNames]);

      const domainUrlMap = new Map<string, Map<string, string[]>>();
      for (const r of group.results) {
        if (hasError(r)) continue;
        const urls: string[] = JSON.parse(r.citedUrls);
        for (const url of urls) {
          const domain = extractDomain(url);
          if (!domainUrlMap.has(domain)) domainUrlMap.set(domain, new Map());
          const variantMap = domainUrlMap.get(domain)!;
          if (!variantMap.has(r.modelVariant)) variantMap.set(r.modelVariant, []);
          variantMap.get(r.modelVariant)!.push(url);
        }
      }

      for (const [domain, variantMap] of domainUrlMap.entries()) {
        const row: string[] = [domain];
        for (const r of group.results) {
          if (hasError(r)) {
            row.push("ERR");
          } else {
            const urls = variantMap.get(r.modelVariant) || [];
            row.push(urls.length > 0 ? urls.map((u) => urlToDisplayPath(u)).join("\n") : "");
          }
        }
        sheetData.push(row);
      }
      sheetData.push([]);
    }

    const ws3 = XLSX.utils.aoa_to_sheet(sheetData);
    ws3["!cols"] = [{ wch: 30 }, ...Array.from({ length: 15 }, () => ({ wch: 60 }))];
    XLSX.utils.book_append_sheet(wb, ws3, "引用ページ（ドメイン別）");
  }

  // === Sheet 4: 引用ページ（モデル別・プロンプト別）===
  {
    const maxCols = 20;
    const sheetData: (string | number)[][] = [];

    for (const [pIdx, group] of sortedGroups) {
      sheetData.push([`プロンプト ${pIdx + 1}: ${group.promptText}`]);
      sheetData.push(["モデル", "ステータス", "引用数", ...Array.from({ length: maxCols }, (_, i) => String(i + 1))]);

      for (const r of group.results) {
        if (hasError(r)) {
          const row: (string | number)[] = [r.modelVariant, "ERR", 0];
          for (let i = 0; i < maxCols; i++) row.push("");
          sheetData.push(row);
        } else {
          const urls: string[] = JSON.parse(r.citedUrls);
          const row: (string | number)[] = [r.modelVariant, "OK", urls.length];
          for (let i = 0; i < maxCols; i++) {
            row.push(i < urls.length ? urlToDisplayPath(urls[i]) : "");
          }
          sheetData.push(row);
        }
      }
      sheetData.push([]);
    }

    const ws4 = XLSX.utils.aoa_to_sheet(sheetData);
    ws4["!cols"] = [{ wch: 28 }, { wch: 10 }, { wch: 8 }, ...Array.from({ length: maxCols }, () => ({ wch: 60 }))];
    XLSX.utils.book_append_sheet(wb, ws4, "引用ページ（モデル)");
  }

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
