import * as XLSX from "xlsx";
import { extractDomain, urlToDisplayPath } from "./ai/url-extractor";

// ──────────────────── 型定義 ────────────────────

interface SurveyResultData {
  promptIndex: number;
  promptText: string;
  modelVariant: string;
  provider: string;
  searchEnabled: boolean;
  serviceMentions: string;
  targetDomainCited: boolean;
  citedUrls: string;
  error: string | null;
}

interface AnalysisData {
  overallScore: number;
  openaiScore: number;
  geminiScore: number;
  claudeScore: number;
  keywordCoverage: number;
  citationRate: number;
  mentionBreakdown: string;
  promptScores: string;
  strengths: string;
  weaknesses: string;
  createdAt: Date;
}

interface DiagnosisData {
  scores: string;
  notes: string;
  totalScore: number;
  maxScore: number;
  categoryA: number;
  categoryB: number;
  categoryC: number;
  categoryD: number;
  createdAt: Date;
}

interface RecommendationData {
  priority: number;
  category: string;
  title: string;
  description: string;
  rationale: string;
  suggestedContent: string | null;
  targetPrompts: string | null;
  status: string;
}

interface ProjectData {
  name: string;
  description: string | null;
  prompt: string;
  targetDomain: string;
  targetServices: string[];
  targetCustomer: string;
  ruleMaking: string;
  createdAt: string;
}

interface FullExportConfig {
  project: ProjectData;
  surveyResults: SurveyResultData[];
  analysis: AnalysisData | null;
  diagnosis: DiagnosisData | null;
  recommendations: RecommendationData[];
}

// ──────────────────── 基礎診断 項目定義 ────────────────────

const DIAGNOSIS_ITEMS = [
  {
    category: "A", categoryName: "技術的要素・アクセシビリティ",
    items: [
      { id: 1, name: "クローラビリティ", point: "robots.txt等でAIボットをブロックしていないか", score5: "拒否設定なし", score3: "特定のフォルダを拒否設定", score1: "AI botを明確に拒否設定" },
      { id: 2, name: "構造化データの実装", point: "Schema.orgでマークアップされ機械可読性が高いか", score5: "OrganizationやProductが表示されエラーなし", score3: "何か表示されるがエラーあり", score1: "検出なし" },
      { id: 3, name: "サイトマップ・階層", point: "重要な情報が論理的に整理されているか", score5: "XML形式のファイルが表示", score3: "404だがフッターにリンクあり", score1: "404でページ自体が存在しない" },
      { id: 4, name: "読み込み速度・UX", point: "コアウェブバイタル等が健全か", score5: "90点以上（緑色）", score3: "50〜89点（黄色）", score1: "49点以下（赤色）" },
      { id: 5, name: "PDF/画像依存度", point: "テキストとして抽出可能か", score5: "すべてテキストで選択可能", score3: "一部が画像", score1: "ほとんどが画像" },
    ],
  },
  {
    category: "B", categoryName: "権威性・信頼性（E-E-A-T）",
    items: [
      { id: 6, name: "企業情報の透明性", point: "会社概要が詳細かつ最新か", score5: "住所/代表者/設立年/資本金/電話番号が全てある", score3: "住所/代表者名くらいしかない", score1: "会社概要ページ自体が見当たらない" },
      { id: 7, name: "ナレッジグラフ登録", point: "エンティティとして認識されているか", score5: "写真・地図付きで詳細なボックス", score3: "地図（Googleマップ）だけ", score1: "何も表示されない" },
      { id: 8, name: "著者・監修者情報", point: "執筆者のプロフィールや専門性が明記されているか", score5: "実名と顔写真・プロフィールあり", score3: "編集部など組織名表記レベル", score1: "誰が書いたか一切記載がない" },
      { id: 9, name: "公的機関・協会", point: "業界団体への加盟や公的認証マーク等", score5: "Pマーク、ISO、業界団体ロゴなど", score3: "認証はないが主要取引先に有名企業", score1: "特に記載がない" },
      { id: 10, name: "Wikipedia等の有無", point: "信頼性の高いデータベースに掲載があるか", score5: "Wikipediaの個別ページ存在", score3: "業界名鑑等に企業名が出ている", score1: "全く出てこない" },
    ],
  },
  {
    category: "C", categoryName: "コンテンツ適合性",
    items: [
      { id: 11, name: "Q&A・FAQの充実", point: "質問に対し直接的な回答形式で記述されているか", score5: "Q&A形式のページがあり十分に情報がある", score3: "ページはあるが数が3つ以下", score1: "FAQページがない" },
      { id: 12, name: "独自データ・一次情報", point: "自社独自の調査データ等が公開されているか", score5: "独自の調査データ・グラフ・事例あり", score3: "一般的な説明だけで独自の数字がない", score1: "抽象的な文章のみで中身が薄い" },
      { id: 13, name: "網羅性と文脈", point: "メリット、価格、比較等が含まれているか", score5: "料金表や詳細仕様が表組みで記載", score3: "要問い合わせだが一部詳細あり", score1: "全て要問い合わせで詳細が一切ない" },
      { id: 14, name: "最新情報の更新頻度", point: "定期更新され最新情報として学習されやすいか", score5: "直近1ヶ月以内に更新あり", score3: "最後の更新が1年以内", score1: "最後の更新が1年以上前" },
      { id: 15, name: "記事構成と構造化", point: "見出しタグで適切に区切られ構造化されているか", score5: "見出しが使われ目次があり論理的に整理", score3: "見出しはあるが階層構造があやふや", score1: "見出しがほとんどなく文字が壁" },
    ],
  },
  {
    category: "D", categoryName: "外部評価・サイテーション",
    items: [
      { id: 16, name: "ニュース・メディア掲載", point: "大手メディアや業界紙での言及があるか", score5: "有名メディアや新聞の記事", score3: "PR TIMESなどのプレスリリースのみ", score1: "検索結果がほとんどない" },
      { id: 17, name: "SNS運用状況", point: "公式SNSが動きサイトと繋がっているか", score5: "定期的に投稿がありフォロワーもいる", score3: "アカウントはあるが更新が止まっている", score1: "アカウントがない" },
      { id: 18, name: "レビュー・口コミ", point: "第三者評価の量と質", score5: "質の高いレビューが多数", score3: "レビューがある程度ある", score1: "レビューが一切存在しない" },
      { id: 19, name: "パートナー連携", point: "他社サイトでのロゴ掲載や紹介があるか", score5: "他社サイトで多数話題にされている", score3: "話題にされているが数は少ない", score1: "検索結果がほぼない" },
      { id: 20, name: "サイテーション", point: "Web上の言及が十分にあるか", score5: "ニュースサイト等で数多く話題にされている", score3: "話題にされているが数は少ない", score1: "検索結果がほぼない" },
    ],
  },
];

// ──────────────────── ユーティリティ ────────────────────

function hasError(r: SurveyResultData): boolean {
  return r.error !== null && r.error !== undefined && r.error.length > 0;
}

function groupByPrompt(results: SurveyResultData[]): Map<number, { promptText: string; results: SurveyResultData[] }> {
  const groups = new Map<number, { promptText: string; results: SurveyResultData[] }>();
  for (const r of results) {
    const idx = r.promptIndex ?? 0;
    if (!groups.has(idx)) groups.set(idx, { promptText: r.promptText || "", results: [] });
    groups.get(idx)!.results.push(r);
  }
  return groups;
}

function getScoreReason(item: { score5: string; score3: string; score1: string }, score: number): string {
  if (score === 5) return item.score5;
  if (score === 3) return item.score3;
  if (score === 1) return item.score1;
  return "";
}

const categoryLabels: Record<string, string> = {
  "research-pr": "リサピー®（調査PR）",
  whitepaper: "ハクピー®（白書）",
  report: "レポピー®（レポート）",
  column: "コラピー®（コラム）",
  "structured-data": "構造化データ",
  content: "コンテンツ",
  faq: "FAQ",
  brand: "ブランド",
  seo: "SEO",
};

const statusLabels: Record<string, string> = {
  pending: "未着手",
  in_progress: "対応中",
  completed: "完了",
  dismissed: "見送り",
};

// ──────────────────── メインエクスポート ────────────────────

export function generateFullExcel(config: FullExportConfig): Buffer {
  const { project, surveyResults, analysis, diagnosis, recommendations } = config;
  const wb = XLSX.utils.book_new();

  // ========== Sheet 1: 概要 ==========
  {
    const data: (string | number)[][] = [
      ["LLMO分析レポート"],
      [],
      ["プロジェクト名", project.name],
      ["作成日", new Date(project.createdAt).toLocaleDateString("ja-JP")],
      ["対象ドメイン", project.targetDomain || "未設定"],
      [],
      ["説明"],
      [project.description || "なし"],
      [],
      ["ターゲット顧客"],
      [project.targetCustomer || "未設定"],
      [],
      ["ルールメイク（条件設定）"],
      [project.ruleMaking || "未設定"],
      [],
      ["調査テキスト言及"],
    ];
    if (project.targetServices.length > 0) {
      for (const svc of project.targetServices) data.push(["", svc]);
    } else {
      data.push(["", "未設定"]);
    }
    data.push([], ["調査プロンプト"]);
    const prompts = project.prompt.split(/\r?\n/).filter((l) => l.trim());
    prompts.forEach((p, i) => data.push([`プロンプト ${i + 1}`, p.trim()]));

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 20 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws, "概要");
  }

  // ========== Sheet 2-5: 調査（既存ロジック） ==========
  if (surveyResults.length > 0) {
    const promptGroups = groupByPrompt(surveyResults);
    const sortedGroups = Array.from(promptGroups.entries()).sort(([a], [b]) => a - b);
    const { targetDomain, targetServices } = project;

    // --- 調査内容 ---
    {
      const prompts = project.prompt.split(/\r?\n/).filter((l) => l.trim());
      const data: (string | number)[][] = [["プロンプト数", prompts.length], []];
      prompts.forEach((p, i) => data.push([`プロンプト ${i + 1}`, p.trim()]));
      data.push([], ["調査対象サイト", targetDomain], []);
      data.push(["調査テキスト言及", ...targetServices.slice(0, 1)]);
      for (let i = 1; i < targetServices.length; i++) data.push(["", targetServices[i]]);
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!cols"] = [{ wch: 18 }, { wch: 60 }];
      XLSX.utils.book_append_sheet(wb, ws, "調査内容");
    }

    // --- テキスト言及状況 ---
    {
      const data: (string | number)[][] = [];
      for (const [pIdx, group] of sortedGroups) {
        const names = group.results.map((r) => r.modelVariant);
        data.push([`プロンプト ${pIdx + 1}: ${group.promptText}`]);
        data.push(["調査テキスト言及", ...names]);
        for (const svc of targetServices) {
          const row: string[] = [svc];
          for (const r of group.results) {
            if (hasError(r)) { row.push("ERR"); continue; }
            const m: Record<string, boolean> = JSON.parse(r.serviceMentions);
            row.push(m[svc] ? "◯" : "×");
          }
          data.push(row);
        }
        const domainRow: string[] = [`${targetDomain} (引用)`];
        for (const r of group.results) {
          domainRow.push(hasError(r) ? "ERR" : r.targetDomainCited ? "◯" : "×");
        }
        data.push(domainRow, []);
      }
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!cols"] = [{ wch: 18 }, ...Array.from({ length: 15 }, () => ({ wch: 22 }))];
      XLSX.utils.book_append_sheet(wb, ws, "テキスト言及状況");
    }

    // --- 引用ページ（ドメイン別） ---
    {
      const data: string[][] = [];
      for (const [pIdx, group] of sortedGroups) {
        const names = group.results.map((r) => r.modelVariant);
        data.push([`プロンプト ${pIdx + 1}: ${group.promptText}`]);
        data.push(["引用ドメイン", ...names]);
        const domainUrlMap = new Map<string, Map<string, string[]>>();
        for (const r of group.results) {
          if (hasError(r)) continue;
          const urls: string[] = JSON.parse(r.citedUrls);
          for (const url of urls) {
            const domain = extractDomain(url);
            if (!domainUrlMap.has(domain)) domainUrlMap.set(domain, new Map());
            const vm = domainUrlMap.get(domain)!;
            if (!vm.has(r.modelVariant)) vm.set(r.modelVariant, []);
            vm.get(r.modelVariant)!.push(url);
          }
        }
        for (const [domain, vm] of domainUrlMap.entries()) {
          const row: string[] = [domain];
          for (const r of group.results) {
            if (hasError(r)) { row.push("ERR"); continue; }
            const urls = vm.get(r.modelVariant) || [];
            row.push(urls.length > 0 ? urls.map((u) => urlToDisplayPath(u)).join("\n") : "");
          }
          data.push(row);
        }
        data.push([]);
      }
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!cols"] = [{ wch: 30 }, ...Array.from({ length: 15 }, () => ({ wch: 60 }))];
      XLSX.utils.book_append_sheet(wb, ws, "引用ページ（ドメイン別）");
    }

    // --- 引用ページ（モデル別） ---
    {
      const maxCols = 20;
      const data: (string | number)[][] = [];
      for (const [pIdx, group] of sortedGroups) {
        data.push([`プロンプト ${pIdx + 1}: ${group.promptText}`]);
        data.push(["モデル", "ステータス", "引用数", ...Array.from({ length: maxCols }, (_, i) => String(i + 1))]);
        for (const r of group.results) {
          if (hasError(r)) {
            const row: (string | number)[] = [r.modelVariant, "ERR", 0, ...Array(maxCols).fill("")];
            data.push(row);
          } else {
            const urls: string[] = JSON.parse(r.citedUrls);
            const row: (string | number)[] = [r.modelVariant, "OK", urls.length];
            for (let i = 0; i < maxCols; i++) row.push(i < urls.length ? urlToDisplayPath(urls[i]) : "");
            data.push(row);
          }
        }
        data.push([]);
      }
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!cols"] = [{ wch: 28 }, { wch: 10 }, { wch: 8 }, ...Array.from({ length: maxCols }, () => ({ wch: 60 }))];
      XLSX.utils.book_append_sheet(wb, ws, "引用ページ（モデル）");
    }
  }

  // ========== Sheet 6: 分析 ==========
  if (analysis) {
    const data: (string | number)[][] = [
      ["分析結果"],
      ["分析日", new Date(analysis.createdAt).toLocaleDateString("ja-JP")],
      [],
      ["総合スコア", Math.round(analysis.overallScore)],
      ["サービス言及率", `${Math.round(analysis.keywordCoverage * 100)}%`],
      ["ドメイン引用率", `${Math.round(analysis.citationRate * 100)}%`],
      [],
      ["AI別スコア"],
      ["ChatGPT (OpenAI)", Math.round(analysis.openaiScore)],
      ["Gemini (Google)", Math.round(analysis.geminiScore)],
      ["Claude (Anthropic)", Math.round(analysis.claudeScore)],
      [],
    ];

    // サービス別言及数
    try {
      const breakdown: Record<string, number> = JSON.parse(analysis.mentionBreakdown);
      data.push(["サービス別言及数"]);
      for (const [svc, count] of Object.entries(breakdown)) {
        data.push(["", svc, count]);
      }
      data.push([]);
    } catch { /* ignore */ }

    // モデル別スコア
    try {
      const modelScores: Record<string, { modelVariant: string; provider: string; score: number; serviceMentions: Record<string, boolean>; domainCited: boolean; hasUrlCitation: boolean }> = JSON.parse(analysis.promptScores);
      data.push(["モデル別スコア"]);
      data.push(["モデル", "プロバイダー", "スコア", "ドメイン引用", "URL引用", "言及サービス"]);
      for (const ms of Object.values(modelScores).sort((a, b) => b.score - a.score)) {
        const mentionedNames = Object.entries(ms.serviceMentions).filter(([, v]) => v).map(([k]) => k);
        data.push([
          ms.modelVariant,
          ms.provider,
          Math.round(ms.score),
          ms.domainCited ? "◯" : "×",
          ms.hasUrlCitation ? "◯" : "×",
          mentionedNames.join(", "),
        ]);
      }
      data.push([]);
    } catch { /* ignore */ }

    // 強み・弱み
    try {
      const strengths: string[] = JSON.parse(analysis.strengths);
      const weaknesses: string[] = JSON.parse(analysis.weaknesses);
      if (strengths.length > 0) {
        data.push(["強み"]);
        for (const s of strengths) data.push(["", s]);
        data.push([]);
      }
      if (weaknesses.length > 0) {
        data.push(["弱み"]);
        for (const w of weaknesses) data.push(["", w]);
      }
    } catch { /* ignore */ }

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 28 }, { wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, "分析");
  }

  // ========== Sheet 7: 基礎診断 ==========
  if (diagnosis) {
    const scores: Record<string, number> = JSON.parse(diagnosis.scores || "{}");
    const notes: Record<string, string> = JSON.parse(diagnosis.notes || "{}");

    const data: (string | number)[][] = [
      ["LLMO基礎診断結果"],
      ["対象ドメイン", project.targetDomain || "未設定"],
      ["診断日", new Date(diagnosis.createdAt).toLocaleDateString("ja-JP")],
      ["総合スコア", diagnosis.totalScore, "/", diagnosis.maxScore, `(${Math.round((diagnosis.totalScore / diagnosis.maxScore) * 100)}%)`],
      [],
      ["No", "カテゴリ", "項目名", "評価ポイント", "評価点数", "評価理由", "メモ"],
    ];

    for (const group of DIAGNOSIS_ITEMS) {
      for (const item of group.items) {
        const sc = scores[String(item.id)];
        const reason = sc !== undefined ? getScoreReason(item, sc) : "";
        const note = notes[String(item.id)] || "";
        data.push([
          item.id,
          `${group.category}. ${group.categoryName}`,
          item.name,
          item.point,
          sc !== undefined ? sc : "",
          reason,
          note,
        ]);
      }
    }

    // カテゴリ別サマリー
    data.push([], ["カテゴリ別スコア"]);
    data.push(["カテゴリ", "スコア", "満点", "割合"]);
    const cats = [
      { key: "A", name: "技術的要素・アクセシビリティ", score: diagnosis.categoryA },
      { key: "B", name: "権威性・信頼性（E-E-A-T）", score: diagnosis.categoryB },
      { key: "C", name: "コンテンツ適合性", score: diagnosis.categoryC },
      { key: "D", name: "外部評価・サイテーション", score: diagnosis.categoryD },
    ];
    for (const cat of cats) {
      data.push([`${cat.key}. ${cat.name}`, cat.score, 25, `${Math.round((cat.score / 25) * 100)}%`]);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 4 }, { wch: 28 }, { wch: 20 }, { wch: 45 }, { wch: 8 }, { wch: 40 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, "基礎診断");
  }

  // ========== Sheet 8: 対策提案 ==========
  if (recommendations.length > 0) {
    const data: (string | number)[][] = [
      ["対策提案一覧"],
      [],
      ["優先度", "カテゴリ", "タイトル", "説明", "根拠", "推奨コンテンツ", "対象プロンプト", "ステータス"],
    ];

    for (const rec of recommendations) {
      let targets = "";
      try {
        const arr: string[] = JSON.parse(rec.targetPrompts || "[]");
        targets = arr.join("\n");
      } catch { /* ignore */ }

      data.push([
        rec.priority,
        categoryLabels[rec.category] || rec.category,
        rec.title,
        rec.description,
        rec.rationale,
        rec.suggestedContent || "",
        targets,
        statusLabels[rec.status] || rec.status,
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [
      { wch: 6 },   // 優先度
      { wch: 22 },  // カテゴリ
      { wch: 35 },  // タイトル
      { wch: 50 },  // 説明
      { wch: 50 },  // 根拠
      { wch: 60 },  // 推奨コンテンツ
      { wch: 40 },  // 対象プロンプト
      { wch: 10 },  // ステータス
    ];
    XLSX.utils.book_append_sheet(wb, ws, "対策提案");
  }

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

// 後方互換: 旧関数を維持
export function generateExcel(config: {
  prompt: string;
  targetDomain: string;
  targetServices: string[];
  results: SurveyResultData[];
}): Buffer {
  return generateFullExcel({
    project: {
      name: "",
      description: null,
      prompt: config.prompt,
      targetDomain: config.targetDomain,
      targetServices: config.targetServices,
      targetCustomer: "",
      ruleMaking: "",
      createdAt: new Date().toISOString(),
    },
    surveyResults: config.results,
    analysis: null,
    diagnosis: null,
    recommendations: [],
  });
}
