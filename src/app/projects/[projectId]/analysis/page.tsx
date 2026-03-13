"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const BarChart = dynamic(
  () => import("recharts").then((mod) => mod.BarChart),
  { ssr: false }
);
const Bar = dynamic(
  () => import("recharts").then((mod) => mod.Bar),
  { ssr: false }
);
const XAxis = dynamic(
  () => import("recharts").then((mod) => mod.XAxis),
  { ssr: false }
);
const YAxis = dynamic(
  () => import("recharts").then((mod) => mod.YAxis),
  { ssr: false }
);
const CartesianGrid = dynamic(
  () => import("recharts").then((mod) => mod.CartesianGrid),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("recharts").then((mod) => mod.Tooltip),
  { ssr: false }
);
const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false }
);

interface Analysis {
  id: string;
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
  createdAt: string;
}

interface ModelScore {
  modelVariant: string;
  provider: string;
  score: number;
  serviceMentions: Record<string, boolean>;
  domainCited: boolean;
  hasUrlCitation: boolean;
}

export default function AnalysisPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/analysis`)
      .then((res) => res.json())
      .then(setAnalysis)
      .finally(() => setLoading(false));
  }, [projectId]);

  async function runAnalysis() {
    setComputing(true);
    const res = await fetch(`/api/projects/${projectId}/analysis`, {
      method: "POST",
    });
    const data = await res.json();
    if (res.ok) {
      setAnalysis(data);
      toast.success("分析が完了しました");
    } else {
      toast.error(data.error || "分析に失敗しました");
    }
    setComputing(false);
  }

  if (loading) return <p className="text-muted-foreground">読み込み中...</p>;

  const providerData = analysis
    ? [
        { name: "ChatGPT", score: Math.round(analysis.openaiScore) },
        { name: "Gemini", score: Math.round(analysis.geminiScore) },
        { name: "Claude", score: Math.round(analysis.claudeScore) },
      ]
    : [];

  const modelScores: Record<string, ModelScore> = analysis
    ? JSON.parse(analysis.promptScores)
    : {};
  const strengths: string[] = analysis ? JSON.parse(analysis.strengths) : [];
  const weaknesses: string[] = analysis ? JSON.parse(analysis.weaknesses) : [];
  const mentionBreakdown: Record<string, number> = analysis
    ? JSON.parse(analysis.mentionBreakdown)
    : {};

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button onClick={runAnalysis} disabled={computing}>
          {computing ? "分析中..." : "分析を実行"}
        </Button>
        {analysis && (
          <span className="text-sm text-muted-foreground">
            最終分析: {new Date(analysis.createdAt).toLocaleString("ja-JP")}
          </span>
        )}
      </div>

      {!analysis ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              調査を完了してから分析を実行してください
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* サマリーカード */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  総合スコア
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">
                  {Math.round(analysis.overallScore)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  サービス言及率
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">
                  {Math.round(analysis.keywordCoverage * 100)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  ドメイン引用率
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">
                  {Math.round(analysis.citationRate * 100)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  サービス別言及数
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1">
                {Object.entries(mentionBreakdown).map(([svc, count]) => (
                  <Badge key={svc} variant="secondary">
                    {svc}: {count}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* プロバイダー比較チャート */}
          <Card>
            <CardHeader>
              <CardTitle>AI別スコア比較</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={providerData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* スコアリング基準 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                スコアリング基準
                <Badge variant="outline" className="font-normal">100点満点</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">テキスト言及率</span>
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">60点</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    登録した調査テキスト言及のうち、AIの回答に含まれた割合。全サービスが言及されれば満点。
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    (言及数 / 全サービス数) × 60
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">ドメイン引用</span>
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">30点</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    対象ドメインがAIの回答中のURLに含まれていれば加点。ブランドの権威性を示す重要指標。
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    ドメイン引用あり → +30
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">URL引用あり</span>
                    <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">10点</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    何らかのURLが引用されていれば加点。Web検索を活用した回答であることを示す。
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    URL引用あり → +10
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">集計方法:</span>{" "}
                  総合スコア = 全モデルの平均 / プロバイダー別スコア = 各社モデルの平均 /
                  テキスト言及率 = 1つでも言及されたモデルの割合 /
                  ドメイン引用率 = ドメインが引用されたモデルの割合 /
                  強み = スコア50以上 / 弱み = スコア50未満
                </p>
              </div>
            </CardContent>
          </Card>

          {/* モデル別スコア */}
          <Card>
            <CardHeader>
              <CardTitle>モデル別スコア</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>モデル</TableHead>
                    <TableHead className="text-center">プロバイダー</TableHead>
                    <TableHead className="text-center">スコア</TableHead>
                    <TableHead className="text-center">
                      <div>テキスト言及</div>
                      <div className="text-xs font-normal text-muted-foreground">60点満点</div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div>ドメイン引用</div>
                      <div className="text-xs font-normal text-muted-foreground">30点</div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div>URL引用</div>
                      <div className="text-xs font-normal text-muted-foreground">10点</div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.values(modelScores)
                    .sort((a, b) => b.score - a.score)
                    .map((ms) => {
                      const mentionedCount = Object.values(ms.serviceMentions).filter(Boolean).length;
                      const totalServices = Math.max(Object.keys(ms.serviceMentions).length, 1);
                      const mentionScore = Math.round((mentionedCount / totalServices) * 60);
                      const mentionedNames = Object.entries(ms.serviceMentions)
                        .filter(([, v]) => v)
                        .map(([k]) => k);

                      return (
                        <TableRow key={ms.modelVariant}>
                          <TableCell className="font-medium">
                            {ms.modelVariant}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{ms.provider}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <ScoreCell score={ms.score} />
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-sm font-medium">
                                {mentionedCount}/{totalServices}
                                <span className="text-xs text-muted-foreground ml-1">({mentionScore}点)</span>
                              </span>
                              {mentionedNames.length > 0 && (
                                <div className="flex flex-wrap justify-center gap-0.5">
                                  {mentionedNames.map((name) => (
                                    <Badge key={name} variant="secondary" className="text-[10px] px-1 py-0">
                                      {name}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {ms.domainCited ? (
                              <span className="text-green-600 font-bold">◯</span>
                            ) : (
                              <span className="text-muted-foreground">×</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {ms.hasUrlCitation ? (
                              <span className="text-green-600 font-bold">◯</span>
                            ) : (
                              <span className="text-muted-foreground">×</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 強み・弱み */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">強み</CardTitle>
              </CardHeader>
              <CardContent>
                {strengths.length > 0 ? (
                  <ul className="space-y-2">
                    {strengths.map((s, i) => (
                      <li key={i} className="text-sm">
                        {s}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    スコア50以上のモデルがありません
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">弱み</CardTitle>
              </CardHeader>
              <CardContent>
                {weaknesses.length > 0 ? (
                  <ul className="space-y-2">
                    {weaknesses.map((w, i) => (
                      <li key={i} className="text-sm">
                        {w}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    弱みは見つかりませんでした
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function ScoreCell({ score }: { score: number }) {
  const rounded = Math.round(score);
  let colorClass = "bg-red-100 text-red-800";
  if (rounded >= 70) colorClass = "bg-green-100 text-green-800";
  else if (rounded >= 40) colorClass = "bg-yellow-100 text-yellow-800";

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}
    >
      {rounded}
    </span>
  );
}
