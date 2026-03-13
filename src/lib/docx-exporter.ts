import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, PageBreak,
  Header, Footer, PageNumber, NumberFormat,
} from "docx";

// ──────────────────── 型定義 ────────────────────

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

export interface DocxExportConfig {
  project: ProjectData;
  analysis: AnalysisData | null;
  diagnosis: DiagnosisData | null;
  recommendations: RecommendationData[];
}

// ──────────────────── 基礎診断 項目定義 ────────────────────

const DIAGNOSIS_ITEMS = [
  {
    category: "A", categoryName: "技術的要素・アクセシビリティ",
    items: [
      { id: 1, name: "クローラビリティ", score5: "拒否設定なし", score3: "特定のフォルダを拒否設定", score1: "AI botを明確に拒否設定" },
      { id: 2, name: "構造化データの実装", score5: "OrganizationやProductが表示されエラーなし", score3: "何か表示されるがエラーあり", score1: "検出なし" },
      { id: 3, name: "サイトマップ・階層", score5: "XML形式のファイルが表示", score3: "404だがフッターにリンクあり", score1: "404でページ自体が存在しない" },
      { id: 4, name: "読み込み速度・UX", score5: "90点以上（緑色）", score3: "50〜89点（黄色）", score1: "49点以下（赤色）" },
      { id: 5, name: "PDF/画像依存度", score5: "すべてテキストで選択可能", score3: "一部が画像", score1: "ほとんどが画像" },
    ],
  },
  {
    category: "B", categoryName: "権威性・信頼性（E-E-A-T）",
    items: [
      { id: 6, name: "企業情報の透明性", score5: "全情報あり", score3: "住所/代表者名のみ", score1: "会社概要ページなし" },
      { id: 7, name: "ナレッジグラフ登録", score5: "詳細なボックス表示", score3: "地図のみ表示", score1: "何も表示されない" },
      { id: 8, name: "著者・監修者情報", score5: "実名と顔写真あり", score3: "組織名表記レベル", score1: "記載なし" },
      { id: 9, name: "公的機関・協会", score5: "認証マークあり", score3: "有名取引先あり", score1: "記載なし" },
      { id: 10, name: "Wikipedia等の有無", score5: "個別ページ存在", score3: "業界名鑑等に掲載", score1: "出てこない" },
    ],
  },
  {
    category: "C", categoryName: "コンテンツ適合性",
    items: [
      { id: 11, name: "Q&A・FAQの充実", score5: "Q&Aが十分ある", score3: "数が3つ以下", score1: "FAQページなし" },
      { id: 12, name: "独自データ・一次情報", score5: "調査データ・グラフ・事例あり", score3: "独自の数字なし", score1: "抽象的な文章のみ" },
      { id: 13, name: "網羅性と文脈", score5: "料金表・詳細仕様が表組みで記載", score3: "一部詳細あり", score1: "詳細が一切ない" },
      { id: 14, name: "最新情報の更新頻度", score5: "直近1ヶ月以内に更新", score3: "1年以内に更新", score1: "1年以上前" },
      { id: 15, name: "記事構成と構造化", score5: "見出し・目次があり論理的", score3: "階層構造があやふや", score1: "見出しなし" },
    ],
  },
  {
    category: "D", categoryName: "外部評価・サイテーション",
    items: [
      { id: 16, name: "ニュース・メディア掲載", score5: "有名メディアの記事", score3: "プレスリリースのみ", score1: "ほとんどない" },
      { id: 17, name: "SNS運用状況", score5: "定期投稿あり", score3: "更新が止まっている", score1: "アカウントなし" },
      { id: 18, name: "レビュー・口コミ", score5: "質の高いレビュー多数", score3: "ある程度ある", score1: "一切存在しない" },
      { id: 19, name: "パートナー連携", score5: "他社で多数話題に", score3: "数は少ない", score1: "ほぼない" },
      { id: 20, name: "サイテーション", score5: "数多く話題にされている", score3: "数は少ない", score1: "ほぼない" },
    ],
  },
];

// ──────────────────── ユーティリティ ────────────────────

const categoryLabels: Record<string, string> = {
  "research-pr": "リサピー®（調査PR）",
  whitepaper: "ハクピー®（白書）",
  report: "レポピー®（レポート）",
  column: "コラピー®（コラム）",
  "structured-data": "構造化データ",
  content: "コンテンツ", faq: "FAQ", brand: "ブランド", seo: "SEO",
};

function getScoreReason(item: { score5: string; score3: string; score1: string }, score: number): string {
  if (score === 5) return item.score5;
  if (score === 3) return item.score3;
  if (score === 1) return item.score1;
  return "";
}

const BORDER = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
} as const;

function headerCell(text: string, width?: number): TableCell {
  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    shading: { type: ShadingType.SOLID, color: "1F4E79" },
    borders: BORDER,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 20, font: "Arial" })] })],
  });
}

function cell(text: string, width?: number): TableCell {
  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    borders: BORDER,
    children: [new Paragraph({ children: [new TextRun({ text, size: 20, font: "Arial" })] })],
  });
}

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({ heading: level, spacing: { before: 300, after: 100 }, children: [new TextRun({ text, font: "Arial" })] });
}

function para(text: string, opts?: { bold?: boolean; size?: number; color?: string }): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, font: "Arial", size: opts?.size ?? 22, bold: opts?.bold, color: opts?.color })],
  });
}

function bulletItem(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40 },
    children: [new TextRun({ text, font: "Arial", size: 20 })],
  });
}

// ──────────────────── メイン生成 ────────────────────

export async function generateProposalDocx(config: DocxExportConfig): Promise<Buffer> {
  const { project, analysis, diagnosis, recommendations } = config;
  const sections: (Paragraph | Table)[] = [];
  const today = new Date().toLocaleDateString("ja-JP");

  // ─── 表紙 ───
  sections.push(new Paragraph({ spacing: { before: 4000 } }));
  sections.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: "LLMO分析・対策提案書", size: 56, bold: true, font: "Arial", color: "1F4E79" })],
  }));
  sections.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text: project.name, size: 36, font: "Arial", color: "333333" })],
  }));
  sections.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text: `対象ドメイン: ${project.targetDomain || "未設定"}`, size: 24, font: "Arial", color: "666666" })],
  }));
  sections.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 2000 },
    children: [new TextRun({ text: `作成日: ${today}`, size: 22, font: "Arial", color: "999999" })],
  }));
  sections.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "株式会社IDEATECH", size: 28, bold: true, font: "Arial" })],
  }));

  // ─── ページブレーク → 目次 ───
  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(heading("目次", HeadingLevel.HEADING_1));
  const tocItems = [
    "1. エグゼクティブサマリー",
    "2. プロジェクト概要",
    "3. LLMO分析結果",
    "4. 基礎診断結果",
    "5. 対策提案",
  ];
  for (const item of tocItems) sections.push(para(item));

  // ─── 1. エグゼクティブサマリー ───
  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(heading("1. エグゼクティブサマリー", HeadingLevel.HEADING_1));

  if (analysis || diagnosis) {
    sections.push(para("本レポートは、LLM（大規模言語モデル）による検索結果において、対象サービスがどのように言及・引用されているかを分析し、AI検索最適化（LLMO）のための具体的な対策を提案するものです。"));
    sections.push(para(""));

    // サマリーテーブル
    const summaryRows = [];
    if (analysis) {
      summaryRows.push(["LLMO総合スコア", `${Math.round(analysis.overallScore)} / 100`]);
      summaryRows.push(["サービス言及率", `${Math.round(analysis.keywordCoverage * 100)}%`]);
      summaryRows.push(["ドメイン引用率", `${Math.round(analysis.citationRate * 100)}%`]);
    }
    if (diagnosis) {
      summaryRows.push(["基礎診断スコア", `${diagnosis.totalScore} / ${diagnosis.maxScore} (${Math.round((diagnosis.totalScore / diagnosis.maxScore) * 100)}%)`]);
    }
    if (summaryRows.length > 0) {
      sections.push(new Table({
        width: { size: 9000, type: WidthType.DXA },
        rows: [
          new TableRow({ children: [headerCell("指標", 4000), headerCell("結果", 5000)] }),
          ...summaryRows.map(([label, value]) =>
            new TableRow({ children: [cell(label, 4000), cell(value, 5000)] })
          ),
        ],
      }));
    }
  }

  // ─── 2. プロジェクト概要 ───
  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(heading("2. プロジェクト概要", HeadingLevel.HEADING_1));

  sections.push(heading("2.1 基本情報", HeadingLevel.HEADING_2));
  sections.push(new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [
      new TableRow({ children: [headerCell("項目", 3000), headerCell("内容", 6000)] }),
      new TableRow({ children: [cell("プロジェクト名", 3000), cell(project.name, 6000)] }),
      new TableRow({ children: [cell("対象ドメイン", 3000), cell(project.targetDomain || "未設定", 6000)] }),
      new TableRow({ children: [cell("ターゲット顧客", 3000), cell(project.targetCustomer || "未設定", 6000)] }),
    ],
  }));

  if (project.targetServices.length > 0) {
    sections.push(heading("2.2 調査テキスト言及", HeadingLevel.HEADING_2));
    for (const svc of project.targetServices) sections.push(bulletItem(svc));
  }

  if (project.ruleMaking) {
    sections.push(heading("2.3 ルールメイク（条件設定）", HeadingLevel.HEADING_2));
    sections.push(para(project.ruleMaking));
  }

  // ─── 3. LLMO分析結果 ───
  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(heading("3. LLMO分析結果", HeadingLevel.HEADING_1));

  if (!analysis) {
    sections.push(para("分析データがありません。調査を実行し、分析を完了してから提案書を出力してください。", { color: "999999" }));
  } else {
    sections.push(heading("3.1 AI別スコア比較", HeadingLevel.HEADING_2));
    sections.push(new Table({
      width: { size: 9000, type: WidthType.DXA },
      rows: [
        new TableRow({ children: [headerCell("AIプロバイダー", 3000), headerCell("スコア", 3000), headerCell("評価", 3000)] }),
        new TableRow({ children: [cell("ChatGPT (OpenAI)", 3000), cell(String(Math.round(analysis.openaiScore)), 3000), cell(analysis.openaiScore >= 70 ? "良好" : analysis.openaiScore >= 40 ? "要改善" : "低い", 3000)] }),
        new TableRow({ children: [cell("Gemini (Google)", 3000), cell(String(Math.round(analysis.geminiScore)), 3000), cell(analysis.geminiScore >= 70 ? "良好" : analysis.geminiScore >= 40 ? "要改善" : "低い", 3000)] }),
        new TableRow({ children: [cell("Claude (Anthropic)", 3000), cell(String(Math.round(analysis.claudeScore)), 3000), cell(analysis.claudeScore >= 70 ? "良好" : analysis.claudeScore >= 40 ? "要改善" : "低い", 3000)] }),
      ],
    }));

    // モデル別スコア
    try {
      const modelScores: Record<string, { modelVariant: string; provider: string; score: number; serviceMentions: Record<string, boolean>; domainCited: boolean }> = JSON.parse(analysis.promptScores);
      sections.push(heading("3.2 モデル別スコア詳細", HeadingLevel.HEADING_2));
      const modelRows = Object.values(modelScores).sort((a, b) => b.score - a.score).map((ms) => {
        const mentioned = Object.entries(ms.serviceMentions).filter(([, v]) => v).map(([k]) => k).join(", ") || "なし";
        return new TableRow({
          children: [
            cell(ms.modelVariant, 2500),
            cell(ms.provider, 1500),
            cell(String(Math.round(ms.score)), 1000),
            cell(ms.domainCited ? "◯" : "×", 1000),
            cell(mentioned, 3000),
          ],
        });
      });
      sections.push(new Table({
        width: { size: 9000, type: WidthType.DXA },
        rows: [
          new TableRow({ children: [headerCell("モデル", 2500), headerCell("プロバイダー", 1500), headerCell("スコア", 1000), headerCell("ドメイン引用", 1000), headerCell("言及サービス", 3000)] }),
          ...modelRows,
        ],
      }));
    } catch { /* ignore */ }

    // 強み・弱み
    try {
      const strengths: string[] = JSON.parse(analysis.strengths);
      const weaknesses: string[] = JSON.parse(analysis.weaknesses);
      sections.push(heading("3.3 強み・弱み分析", HeadingLevel.HEADING_2));
      if (strengths.length > 0) {
        sections.push(para("【強み】", { bold: true, color: "2E7D32" }));
        for (const s of strengths) sections.push(bulletItem(s));
      }
      if (weaknesses.length > 0) {
        sections.push(para("【弱み】", { bold: true, color: "C62828" }));
        for (const w of weaknesses) sections.push(bulletItem(w));
      }
    } catch { /* ignore */ }
  }

  // ─── 4. 基礎診断結果 ───
  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(heading("4. 基礎診断結果", HeadingLevel.HEADING_1));

  if (!diagnosis) {
    sections.push(para("基礎診断データがありません。", { color: "999999" }));
  } else {
    const scores: Record<string, number> = JSON.parse(diagnosis.scores || "{}");
    const notes: Record<string, string> = JSON.parse(diagnosis.notes || "{}");

    sections.push(heading("4.1 総合スコア", HeadingLevel.HEADING_2));
    const pct = Math.round((diagnosis.totalScore / diagnosis.maxScore) * 100);
    sections.push(para(`${diagnosis.totalScore} / ${diagnosis.maxScore}点 (${pct}%)`, { bold: true, size: 28 }));

    // カテゴリ別サマリー
    sections.push(heading("4.2 カテゴリ別スコア", HeadingLevel.HEADING_2));
    sections.push(new Table({
      width: { size: 9000, type: WidthType.DXA },
      rows: [
        new TableRow({ children: [headerCell("カテゴリ", 4500), headerCell("スコア", 1500), headerCell("満点", 1500), headerCell("割合", 1500)] }),
        new TableRow({ children: [cell("A. 技術的要素・アクセシビリティ", 4500), cell(String(diagnosis.categoryA), 1500), cell("25", 1500), cell(`${Math.round((diagnosis.categoryA / 25) * 100)}%`, 1500)] }),
        new TableRow({ children: [cell("B. 権威性・信頼性（E-E-A-T）", 4500), cell(String(diagnosis.categoryB), 1500), cell("25", 1500), cell(`${Math.round((diagnosis.categoryB / 25) * 100)}%`, 1500)] }),
        new TableRow({ children: [cell("C. コンテンツ適合性", 4500), cell(String(diagnosis.categoryC), 1500), cell("25", 1500), cell(`${Math.round((diagnosis.categoryC / 25) * 100)}%`, 1500)] }),
        new TableRow({ children: [cell("D. 外部評価・サイテーション", 4500), cell(String(diagnosis.categoryD), 1500), cell("25", 1500), cell(`${Math.round((diagnosis.categoryD / 25) * 100)}%`, 1500)] }),
      ],
    }));

    // 項目別詳細
    sections.push(heading("4.3 項目別詳細", HeadingLevel.HEADING_2));
    for (const group of DIAGNOSIS_ITEMS) {
      sections.push(para(`【${group.category}. ${group.categoryName}】`, { bold: true, size: 22 }));
      const itemRows = group.items.map((item) => {
        const sc = scores[String(item.id)];
        const reason = sc !== undefined ? getScoreReason(item, sc) : "未評価";
        const note = notes[String(item.id)] || "";
        return new TableRow({
          children: [
            cell(String(item.id), 500),
            cell(item.name, 2000),
            cell(sc !== undefined ? `${sc}点` : "-", 800),
            cell(reason, 3200),
            cell(note, 2500),
          ],
        });
      });
      sections.push(new Table({
        width: { size: 9000, type: WidthType.DXA },
        rows: [
          new TableRow({ children: [headerCell("No", 500), headerCell("項目", 2000), headerCell("点数", 800), headerCell("評価理由", 3200), headerCell("メモ", 2500)] }),
          ...itemRows,
        ],
      }));
      sections.push(para(""));
    }
  }

  // ─── 5. 対策提案 ───
  sections.push(new Paragraph({ children: [new PageBreak()] }));
  sections.push(heading("5. 対策提案", HeadingLevel.HEADING_1));

  if (recommendations.length === 0) {
    sections.push(para("対策提案データがありません。", { color: "999999" }));
  } else {
    sections.push(para(`分析結果に基づき、以下の${recommendations.length}件の対策を提案します。`));
    sections.push(para(""));

    for (const rec of recommendations) {
      sections.push(heading(`提案${rec.priority}: ${rec.title}`, HeadingLevel.HEADING_2));
      sections.push(new Table({
        width: { size: 9000, type: WidthType.DXA },
        rows: [
          new TableRow({ children: [headerCell("項目", 2000), headerCell("内容", 7000)] }),
          new TableRow({ children: [cell("カテゴリ", 2000), cell(categoryLabels[rec.category] || rec.category, 7000)] }),
          new TableRow({ children: [cell("説明", 2000), cell(rec.description, 7000)] }),
          new TableRow({ children: [cell("根拠", 2000), cell(rec.rationale, 7000)] }),
        ],
      }));

      if (rec.suggestedContent) {
        sections.push(para("推奨コンテンツ（ドラフト）:", { bold: true }));
        // 複数行のコンテンツを段落に分割
        for (const line of rec.suggestedContent.split("\n")) {
          if (line.trim()) sections.push(para(line.trim(), { size: 20 }));
        }
      }

      let targets: string[] = [];
      try { targets = JSON.parse(rec.targetPrompts || "[]"); } catch { /* ignore */ }
      if (targets.length > 0) {
        sections.push(para("対象プロンプト:", { bold: true }));
        for (const t of targets) sections.push(bulletItem(t));
      }
      sections.push(para(""));
    }
  }

  // ─── Document 生成 ───
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 22 },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1080, bottom: 1440, left: 1080 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: `LLMO分析・対策提案書 — ${project.name}`, size: 16, color: "999999", font: "Arial" })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "- ", size: 16, color: "999999" }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "999999" }),
              new TextRun({ text: " -", size: 16, color: "999999" }),
            ],
          })],
        }),
      },
      children: sections,
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
