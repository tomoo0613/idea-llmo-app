"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import * as XLSX from "xlsx";

// 20項目の診断定義
const DIAGNOSIS_ITEMS = [
  {
    category: "A",
    categoryName: "技術的要素・アクセシビリティ",
    categoryDesc: "LLMが企業の情報を正しくクロール・学習できる状態にあるか",
    items: [
      {
        id: 1,
        name: "クローラビリティ",
        point: "robots.txt等でAIボット（GPTBotなど）をブロックしていないか",
        method: "URLの末尾に /robots.txt をつけてアクセスし、DisallowにAI botが存在しないかを確認する",
        score5: "拒否設定なし",
        score3: "特定のフォルダを拒否設定",
        score1: "AI botを明確に拒否設定",
      },
      {
        id: 2,
        name: "構造化データの実装",
        point: "会社概要、製品情報などがSchema.orgでマークアップされ、機械可読性が高いか",
        method: "Schema Validator(https://validator.schema.org/)にTOPページのURLを入力してテストを実行",
        score5: "OrganizationやProductが表示され、エラーがない",
        score3: "何か表示されるが、エラー（赤字）が出る",
        score1: "「検出なし」と表示される",
      },
      {
        id: 3,
        name: "サイトマップ・階層",
        point: "重要な情報が深い階層に埋もれず、論理的に整理されているか",
        method: "URLの末尾に /sitemap.xml をつけてアクセスする",
        score5: "XML形式のファイルが表示される",
        score3: "404エラーだが、フッターに「サイトマップ」リンクがある",
        score1: "404エラーで、ページ自体が存在しない",
      },
      {
        id: 4,
        name: "読み込み速度・UX",
        point: "コアウェブバイタル等の指標が健全か",
        method: "PageSpeed Insights(https://pagespeed.web.dev/)でURLを測定",
        score5: "スコアが90点以上（緑色）",
        score3: "スコアが50〜89点（黄色）",
        score1: "スコアが49点以下（赤色）",
      },
      {
        id: 5,
        name: "PDF/画像依存度",
        point: "重要なテキスト情報が画像化されておらず、テキストとして抽出可能か",
        method: "会社概要や製品説明の文字をマウスでドラッグ（選択）できるか確認",
        score5: "重要な説明文がすべてテキストで選択できる",
        score3: "一部はテキストだが、重要な表などが画像になっている",
        score1: "ほとんどが画像で、文字を選択できない",
      },
    ],
  },
  {
    category: "B",
    categoryName: "権威性・信頼性（E-E-A-T）",
    categoryDesc: "この企業の情報は信頼に足るかというシグナルが十分に存在するか",
    items: [
      {
        id: 6,
        name: "企業情報の透明性",
        point: "会社概要・沿革・代表者情報が詳細かつ最新か",
        method: "サイト内の「会社概要」ページを確認する",
        score5: "住所/代表者/設立年/資本金/電話番号が全てある",
        score3: "住所/代表者名くらいしかない",
        score1: "会社概要ページ自体が見当たらない",
      },
      {
        id: 7,
        name: "ナレッジグラフ登録",
        point: "Googleナレッジパネル等のエンティティとして認識されているか",
        method: "Googleで「会社名」を検索。PC画面の右側に企業情報ボックスが出るか確認",
        score5: "写真・地図付きで詳細なボックスが出る",
        score3: "地図（Googleマップ）だけが表示される",
        score1: "何も表示されない",
      },
      {
        id: 8,
        name: "著者・監修者情報",
        point: "専門記事に執筆者のプロフィールや専門性が明記されているか",
        method: "ブログやコラム記事の末尾や冒頭を確認する",
        score5: "執筆者の「実名」と「顔写真・プロフィール」がある",
        score3: "「編集部」「広報担当」などの組織名表記レベル",
        score1: "誰が書いたか一切記載がない",
      },
      {
        id: 9,
        name: "公的機関・協会",
        point: "業界団体への加盟や公的認証マーク等がサイトに明記されているか",
        method: "サイトのフッターや会社概要を確認する",
        score5: "Pマーク、ISO、業界団体ロゴなどが貼ってある",
        score3: "認証はないが、主要取引先に有名企業がある",
        score1: "特に記載がない",
      },
      {
        id: 10,
        name: "Wikipedia等の有無",
        point: "Wikipediaや信頼性の高いデータベースに掲載があるか",
        method: "Googleで「会社名 Wikipedia」で検索する",
        score5: "Wikipediaの個別ページが存在する",
        score3: "Wikipediaはないが、業界名鑑等には企業名が出ている",
        score1: "全く出てこない",
      },
    ],
  },
  {
    category: "C",
    categoryName: "コンテンツ適合性",
    categoryDesc: "ユーザーの問いに対して、LLMが引用しやすい形式で情報が存在するか",
    items: [
      {
        id: 11,
        name: "Q&A・FAQの充実",
        point: "「〜とは？」等の質問に対し、直接的な回答形式で記述されているか",
        method: "サイト内に「よくある質問」や「Q&A」があるか確認する",
        score5: "Q&A形式のページがあり、十分に情報がある",
        score3: "ページはあるが、数が3つ以下と少ない",
        score1: "FAQページがない",
      },
      {
        id: 12,
        name: "独自データ・一次情報",
        point: "自社独自の調査データ、統計、事例が公開されているか",
        method: "製品ページやブログを確認する",
        score5: "自社独自の「調査データ」「グラフ」「事例」がある",
        score3: "一般的な説明だけで、独自の数字がない",
        score1: "抽象的な文章のみで中身が薄い",
      },
      {
        id: 13,
        name: "網羅性と文脈",
        point: "サービス名だけでなく、文脈（メリット、価格、比較）が含まれているか",
        method: "サービス紹介ページを確認する",
        score5: "料金表や詳細仕様が表組みでわかりやすく記載",
        score3: "「要問い合わせ」だが、目安の数字や一部詳細はある",
        score1: "全て「要問い合わせ」で数字や詳細が一切ない",
      },
      {
        id: 14,
        name: "最新情報の更新頻度",
        point: "プレスリリースやブログが定期更新され、最新情報として学習されやすいか",
        method: "「ニュース」や「お知らせ」の日付を確認する",
        score5: "直近1ヶ月以内に更新がある",
        score3: "最後の更新が1年以内",
        score1: "最後の更新が1年以上前（放置）",
      },
      {
        id: 15,
        name: "記事構成と構造化",
        point: "記事が見出しタグ（h2, h3など）で適切に区切られ、構造化されているか",
        method: "記事や説明文の見た目を確認",
        score5: "見出し（h2・h3・h4）が使われ、目次があり、論理的に整理",
        score3: "見出しはあるが、階層構造があやふや",
        score1: "見出しがほとんどなく、文字が壁になっている",
      },
    ],
  },
  {
    category: "D",
    categoryName: "外部評価・サイテーション",
    categoryDesc: "Web全体での言及数や評判が十分に存在するか",
    items: [
      {
        id: 16,
        name: "ニュース・メディア掲載",
        point: "信頼できる大手メディアや業界紙での言及があるか",
        method: "Googleの「ニュース」タブで会社名を検索",
        score5: "有名メディアや新聞などの記事が出てくる",
        score3: "PR TIMESなどのプレスリリースのみ出る",
        score1: "検索結果がほとんどない",
      },
      {
        id: 17,
        name: "SNS運用状況",
        point: "公式SNSが動き、サイトと繋がっているか",
        method: "サイト上のX, Facebook等のアイコンをクリックする",
        score5: "定期的に投稿があり、フォロワーもついている",
        score3: "アカウントはあるが、更新が止まっている",
        score1: "アカウントがない",
      },
      {
        id: 18,
        name: "レビュー・口コミ",
        point: "Googleマップ、比較サイト等での第三者評価の量と質",
        method: "Googleや比較サイト上でレビュー・口コミが存在するか確認",
        score5: "質の高いレビューや評価が多数ついている",
        score3: "レビューや評価がある程度ついている",
        score1: "レビューや評価が一切存在しない",
      },
      {
        id: 19,
        name: "パートナー連携",
        point: "他社サイト（導入事例など）でのロゴ掲載や紹介があるか",
        method: "Googleで \"会社名\" -site:自社ドメイン で検索",
        score5: "他社サイトで話題にされており、その数も多い",
        score3: "他社サイトで話題にされているが、数は少ない",
        score1: "検索結果がほぼない",
      },
      {
        id: 20,
        name: "サイテーション",
        point: "Web上の言及が必要十分になっているか",
        method: "Googleで \"会社名\" -site:自社ドメイン で検索",
        score5: "ニュースサイトや他社サイトで話題にされ、数も多い",
        score3: "話題にされているが、数は少ない",
        score1: "検索結果がほぼない",
      },
    ],
  },
];

const categoryColors: Record<string, string> = {
  A: "bg-blue-100 text-blue-800 border-blue-200",
  B: "bg-green-100 text-green-800 border-green-200",
  C: "bg-purple-100 text-purple-800 border-purple-200",
  D: "bg-orange-100 text-orange-800 border-orange-200",
};

const categoryBgColors: Record<string, string> = {
  A: "border-l-blue-500",
  B: "border-l-green-500",
  C: "border-l-purple-500",
  D: "border-l-orange-500",
};

// スコアから理由テキストを取得
function getScoreReason(item: { score5: string; score3: string; score1: string }, score: number): string {
  if (score === 5) return item.score5;
  if (score === 3) return item.score3;
  if (score === 1) return item.score1;
  return "";
}

interface SavedDiagnosis {
  id: string;
  scores: string;
  notes: string;
  totalScore: number;
  maxScore: number;
  categoryA: number;
  categoryB: number;
  categoryC: number;
  categoryD: number;
  createdAt: string;
}

interface ProjectInfo {
  id: string;
  name: string;
  targetDomain: string;
}

export default function DiagnosisPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<SavedDiagnosis | null>(null);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    // プロジェクト情報と診断データを並列取得
    Promise.all([
      fetch(`/api/projects/${projectId}`).then((res) => res.json()),
      fetch(`/api/projects/${projectId}/diagnosis`).then((res) => res.json()),
    ])
      .then(([proj, data]: [ProjectInfo, SavedDiagnosis | null]) => {
        setProject(proj);
        if (data) {
          setSaved(data);
          setStarted(true);
          try {
            setScores(JSON.parse(data.scores));
            setNotes(JSON.parse(data.notes));
          } catch { /* ignore */ }
        }
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  function setScore(id: number, value: number) {
    setScores((prev) => ({ ...prev, [String(id)]: value }));
  }

  function setNote(id: number, value: string) {
    setNotes((prev) => ({ ...prev, [String(id)]: value }));
  }

  async function saveDiagnosis() {
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/diagnosis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scores, notes }),
    });
    const data = await res.json();
    if (res.ok) {
      setSaved(data);
      toast.success("基礎診断を保存しました");
    } else {
      toast.error(data.error || "保存に失敗しました");
    }
    setSaving(false);
  }

  function exportToExcel() {
    const wb = XLSX.utils.book_new();

    // ヘッダー行
    const rows: (string | number)[][] = [
      ["LLMO基礎診断結果"],
      ["対象ドメイン", domain || "未設定"],
      ["診断日", saved ? new Date(saved.createdAt).toLocaleDateString("ja-JP") : new Date().toLocaleDateString("ja-JP")],
      ["総合スコア", totalScore, "/", maxScore, `(${percentage}%)`],
      [],
      ["No", "カテゴリ", "項目名", "評価ポイント", "確認方法", "評価点数", "評価理由", "メモ"],
    ];

    // 各項目のデータ行
    for (const group of DIAGNOSIS_ITEMS) {
      for (const item of group.items) {
        const sc = scores[String(item.id)];
        const reason = sc !== undefined ? getScoreReason(item, sc) : "";
        const note = notes[String(item.id)] || "";
        rows.push([
          item.id,
          `${group.category}. ${group.categoryName}`,
          item.name,
          item.point,
          item.method,
          sc !== undefined ? sc : "",
          reason,
          note,
        ]);
      }
    }

    // カテゴリ別サマリー
    rows.push([]);
    rows.push(["カテゴリ別スコア"]);
    rows.push(["カテゴリ", "スコア", "満点", "割合"]);
    const catMap = { A: categoryScores.A, B: categoryScores.B, C: categoryScores.C, D: categoryScores.D };
    for (const group of DIAGNOSIS_ITEMS) {
      const cs = catMap[group.category as keyof typeof catMap];
      rows.push([
        `${group.category}. ${group.categoryName}`,
        cs,
        25,
        `${Math.round((cs / 25) * 100)}%`,
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // 列幅設定
    ws["!cols"] = [
      { wch: 4 },   // No
      { wch: 28 },  // カテゴリ
      { wch: 20 },  // 項目名
      { wch: 45 },  // 評価ポイント
      { wch: 50 },  // 確認方法
      { wch: 8 },   // 評価点数
      { wch: 40 },  // 評価理由
      { wch: 30 },  // メモ
    ];

    XLSX.utils.book_append_sheet(wb, ws, "基礎診断");
    XLSX.writeFile(wb, `LLMO基礎診断_${domain || "未設定"}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excelファイルをダウンロードしました");
  }

  // スコア集計
  const totalScore = Object.values(scores).reduce((sum, v) => sum + v, 0);
  const answeredCount = Object.keys(scores).length;
  const maxScore = 100;
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  const categoryScores = {
    A: [1, 2, 3, 4, 5].reduce((s, i) => s + (scores[String(i)] || 0), 0),
    B: [6, 7, 8, 9, 10].reduce((s, i) => s + (scores[String(i)] || 0), 0),
    C: [11, 12, 13, 14, 15].reduce((s, i) => s + (scores[String(i)] || 0), 0),
    D: [16, 17, 18, 19, 20].reduce((s, i) => s + (scores[String(i)] || 0), 0),
  };

  function getScoreColor(score: number, max: number) {
    const pct = (score / max) * 100;
    if (pct >= 80) return "text-green-600";
    if (pct >= 50) return "text-yellow-600";
    return "text-red-600";
  }

  function startDiagnosis() {
    setStarted(true);
    setExpandedItem(1); // 最初の項目を開く
  }

  if (loading) return <p className="text-muted-foreground">読み込み中...</p>;

  const domain = project?.targetDomain || "";

  return (
    <div className="space-y-6">
      {/* 対象サイト＋診断開始 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">診断対象サイト</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xl font-bold">{domain || "未設定"}</span>
                {domain && (
                  <a
                    href={`https://${domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    サイトを開く &rarr;
                  </a>
                )}
              </div>
              {saved && (
                <p className="text-xs text-muted-foreground mt-1">
                  最終診断: {new Date(saved.createdAt).toLocaleDateString("ja-JP")}
                </p>
              )}
            </div>
            {!started ? (
              <Button onClick={startDiagnosis} size="lg">
                診断を開始
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setScores({});
                    setNotes({});
                    setSaved(null);
                    setExpandedItem(1);
                  }}
                >
                  リセット
                </Button>
                <Button
                  variant="outline"
                  onClick={exportToExcel}
                  disabled={answeredCount === 0}
                >
                  📥 Excel出力
                </Button>
                <Button
                  onClick={saveDiagnosis}
                  disabled={saving || answeredCount === 0}
                >
                  {saving ? "保存中..." : "診断を保存"}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!started ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-lg font-medium">LLMO基礎診断（20項目）</p>
            <p className="text-sm text-muted-foreground">
              対象ドメインのLLMO対応状況を4カテゴリ・20項目で診断します。
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto mt-4">
              {(["A", "B", "C", "D"] as const).map((cat) => {
                const catInfo = DIAGNOSIS_ITEMS.find((c) => c.category === cat)!;
                return (
                  <div key={cat} className={`p-3 rounded-md border ${categoryColors[cat]}`}>
                    <p className="font-bold text-sm">{cat}. {catInfo.categoryName}</p>
                    <p className="text-xs mt-1">5項目</p>
                  </div>
                );
              })}
            </div>
            <Button onClick={startDiagnosis} size="lg" className="mt-4">
              診断を開始する
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="md:col-span-1">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">総合スコア</p>
            <p className={`text-4xl font-bold ${getScoreColor(totalScore, maxScore)}`}>
              {totalScore}<span className="text-lg text-muted-foreground">/{maxScore}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">{percentage}%（{answeredCount}/20項目回答済み）</p>
          </CardContent>
        </Card>

        {(["A", "B", "C", "D"] as const).map((cat) => {
          const catInfo = DIAGNOSIS_ITEMS.find((c) => c.category === cat)!;
          return (
            <Card key={cat}>
              <CardContent className="pt-6 text-center">
                <Badge className={categoryColors[cat]}>{cat}</Badge>
                <p className="text-xs text-muted-foreground mt-1">{catInfo.categoryName}</p>
                <p className={`text-2xl font-bold mt-1 ${getScoreColor(categoryScores[cat], 25)}`}>
                  {categoryScores[cat]}<span className="text-sm text-muted-foreground">/25</span>
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 診断項目一覧 */}
      {DIAGNOSIS_ITEMS.map((group) => (
        <div key={group.category} className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className={categoryColors[group.category]} variant="outline">
              {group.category}
            </Badge>
            <h2 className="text-lg font-semibold">{group.categoryName}</h2>
          </div>
          <p className="text-sm text-muted-foreground ml-8">{group.categoryDesc}</p>

          {group.items.map((item) => {
            const currentScore = scores[String(item.id)];
            const isExpanded = expandedItem === item.id;

            return (
              <Card
                key={item.id}
                className={`border-l-4 ${categoryBgColors[group.category]}`}
              >
                <CardHeader
                  className="cursor-pointer pb-2"
                  onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-bold">
                        {item.id}
                      </span>
                      <div>
                        <CardTitle className="text-sm">{item.name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.point}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {currentScore !== undefined && (
                        <div className="flex items-center gap-2">
                          <Badge variant={currentScore >= 5 ? "default" : currentScore >= 3 ? "secondary" : "destructive"}>
                            {currentScore}点
                          </Badge>
                          {!isExpanded && (
                            <span className="text-xs text-muted-foreground max-w-[200px] truncate">
                              {getScoreReason(item, currentScore)}
                            </span>
                          )}
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="space-y-4 pt-0">
                    <div className="bg-muted/50 p-3 rounded-md">
                      <p className="text-xs font-medium text-muted-foreground mb-1">確認方法</p>
                      <p className="text-sm">{item.method}</p>
                    </div>

                    {/* スコア選択 */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">評価を選択</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setScore(item.id, 5); }}
                          className={`p-3 rounded-md border text-left text-sm transition-colors ${
                            currentScore === 5
                              ? "border-green-500 bg-green-50 ring-2 ring-green-200"
                              : "hover:border-green-300 hover:bg-green-50/50"
                          }`}
                        >
                          <span className="font-bold text-green-600">5点</span>
                          <p className="text-xs mt-1">{item.score5}</p>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setScore(item.id, 3); }}
                          className={`p-3 rounded-md border text-left text-sm transition-colors ${
                            currentScore === 3
                              ? "border-yellow-500 bg-yellow-50 ring-2 ring-yellow-200"
                              : "hover:border-yellow-300 hover:bg-yellow-50/50"
                          }`}
                        >
                          <span className="font-bold text-yellow-600">3点</span>
                          <p className="text-xs mt-1">{item.score3}</p>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setScore(item.id, 1); }}
                          className={`p-3 rounded-md border text-left text-sm transition-colors ${
                            currentScore === 1
                              ? "border-red-500 bg-red-50 ring-2 ring-red-200"
                              : "hover:border-red-300 hover:bg-red-50/50"
                          }`}
                        >
                          <span className="font-bold text-red-600">1点</span>
                          <p className="text-xs mt-1">{item.score1}</p>
                        </button>
                      </div>
                    </div>

                    {/* メモ */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">メモ（任意）</p>
                      <textarea
                        value={notes[String(item.id)] || ""}
                        onChange={(e) => setNote(item.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="確認結果や気づきを記録..."
                        className="w-full p-2 border rounded-md text-sm resize-none h-16 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      ))}

      {/* 保存ボタン（フッター固定） */}
      <div className="sticky bottom-4 flex justify-center">
        <Button
          onClick={saveDiagnosis}
          disabled={saving || answeredCount === 0}
          size="lg"
          className="shadow-lg"
        >
          {saving ? "保存中..." : `基礎診断を保存（${answeredCount}/20項目）`}
        </Button>
      </div>

        </>
      )}
    </div>
  );
}
