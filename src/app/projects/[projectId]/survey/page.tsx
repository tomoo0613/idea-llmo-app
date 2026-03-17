"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface Project {
  prompt: string;
  targetDomain: string;
  targetServices: string;
}

interface Survey {
  id: string;
  status: string;
  totalSteps: number;
  doneSteps: number;
  startedAt: string | null;
  completedAt: string | null;
}

interface SurveyResult {
  id: string;
  promptIndex: number;
  promptText: string;
  modelVariant: string;
  provider: string;
  searchEnabled: boolean;
  responseText: string;
  serviceMentions: string;
  targetDomainCited: boolean;
  citedUrls: string;
  error: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  pending: { label: "待機中", variant: "secondary", color: "text-muted-foreground" },
  running: { label: "実行中", variant: "default", color: "text-blue-600" },
  completed: { label: "完了", variant: "outline", color: "text-green-600" },
  failed: { label: "失敗", variant: "destructive", color: "text-red-600" },
};

/** 1ステップあたりの平均秒数（目安計算用） */
const AVG_SECONDS_PER_STEP = 8;

const PROVIDER_COLORS: Record<string, string> = {
  openai: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  gemini: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  claude: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

export default function SurveyPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [results, setResults] = useState<SurveyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/survey`).then((r) => r.json()),
    ]).then(([proj, surveyData]) => {
      setProject(proj);
      setSurvey(surveyData.survey);
      setResults(surveyData.results || []);
      if (surveyData.survey?.status === "running") setRunning(true);
      setLoading(false);
    });
  }, [projectId]);

  // 経過時間タイマー
  useEffect(() => {
    if (running) {
      setElapsedTime(0);
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running]);

  // ポーリング
  useEffect(() => {
    if (!survey || survey.status !== "running") return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/projects/${projectId}/survey`);
      const data = await res.json();
      if (data.survey) {
        setSurvey(data.survey);
        setResults(data.results || []);
        if (data.survey.status === "completed") {
          setRunning(false);
          toast.success("調査が完了しました", {
            description: `${data.results?.length || 0}件の結果を取得しました`,
            duration: 5000,
          });
        } else if (data.survey.status === "failed") {
          setRunning(false);
          toast.error("調査が失敗しました", { duration: 5000 });
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [survey, projectId]);

  // プロンプトごとにグループ化
  const promptGroups = useMemo(() => {
    const groups: Map<number, { promptText: string; results: SurveyResult[] }> = new Map();
    for (const r of results) {
      const idx = r.promptIndex ?? 0;
      if (!groups.has(idx)) {
        groups.set(idx, { promptText: r.promptText || "", results: [] });
      }
      groups.get(idx)!.results.push(r);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [results]);

  async function startSurvey() {
    setRunning(true);
    setElapsedTime(0);
    setExpandedModels(new Set());
    const res = await fetch(`/api/projects/${projectId}/survey`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setSurvey(data.survey);
      setResults([]);
      toast.info("調査を開始しました", {
        description: "各プロンプト × 各AIモデルに順次問い合わせを行います",
      });
    } else {
      setRunning(false);
      toast.error(data.error || "調査の開始に失敗しました");
    }
  }

  function downloadExcel() {
    window.open(`/api/projects/${projectId}/export`, "_blank");
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}分${s.toString().padStart(2, "0")}秒` : `${s}秒`;
  }

  function toggleExpand(id: string) {
    setExpandedModels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /** 対象サービス名をハイライトしたHTMLを返す */
  function highlightServices(text: string, services: string[]): string {
    if (!text || services.length === 0) return text;
    let result = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    for (const svc of services) {
      if (!svc) continue;
      const escaped = svc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(${escaped})`, "gi");
      result = result.replace(
        regex,
        '<mark class="bg-yellow-200 dark:bg-yellow-800 text-foreground px-0.5 rounded font-medium">$1</mark>'
      );
    }
    return result;
  }

  if (loading) return <p className="text-muted-foreground">読み込み中...</p>;

  const targetServices: string[] = project?.targetServices
    ? JSON.parse(project.targetServices)
    : [];

  const progressPercent = survey && survey.totalSteps > 0
    ? Math.round((survey.doneSteps / survey.totalSteps) * 100)
    : 0;

  // 推定残り時間の計算
  const estimatedRemaining = (() => {
    if (!survey || survey.doneSteps === 0 || survey.totalSteps === 0 || elapsedTime === 0) return null;
    const avgPerStep = elapsedTime / survey.doneSteps;
    return Math.round(avgPerStep * (survey.totalSteps - survey.doneSteps));
  })();

  const statusConfig = survey ? STATUS_CONFIG[survey.status] || STATUS_CONFIG.pending : null;

  return (
    <div className="space-y-6">
      {/* 調査概要 */}
      <Card>
        <CardHeader>
          <CardTitle>調査設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <span className="font-medium">プロンプト:</span>
            {project?.prompt ? (
              <ul className="mt-1 space-y-1 ml-4">
                {project.prompt.split(/\r?\n/).filter((l) => l.trim()).map((line, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0 text-xs">{i + 1}</Badge>
                    <span>{line.trim()}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-muted-foreground"> 未設定</span>
            )}
          </div>
          <p><span className="font-medium">対象ドメイン:</span> {project?.targetDomain || "未設定"}</p>
          <p>
            <span className="font-medium">対象サービス:</span>{" "}
            {targetServices.map((s, i) => (
              <Badge key={i} variant="secondary" className="mr-1">{s}</Badge>
            ))}
          </p>
        </CardContent>
      </Card>

      {/* 実行コントロール + 進捗表示 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>調査実行</CardTitle>
            {statusConfig && survey && (
              <Badge variant={statusConfig.variant} className="text-xs">
                {statusConfig.label}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button onClick={startSurvey} disabled={running || !project?.prompt}>
              {running ? "実行中..." : survey?.status === "completed" ? "再調査" : "調査を開始"}
            </Button>
            {survey?.status === "completed" && (
              <Button variant="outline" onClick={downloadExcel}>
                Excelダウンロード
              </Button>
            )}
          </div>

          {/* 開始前：目安時間の表示 */}
          {(!survey || survey.status === "pending" || survey.status === "completed" || survey.status === "failed") && !running && project?.prompt && (
            <div className="p-3 rounded-lg border bg-muted/30 text-sm text-muted-foreground">
              {(() => {
                const promptCount = project.prompt.split(/\r?\n/).filter((l: string) => l.trim()).length;
                const modelCount = 10; // MODEL_VARIANTS の数
                const totalSteps = promptCount * modelCount;
                const estMinutes = Math.ceil((totalSteps * AVG_SECONDS_PER_STEP) / 60);
                return (
                  <div className="flex items-center gap-3">
                    <span>実行目安:</span>
                    <span className="font-medium text-foreground">
                      {promptCount}プロンプト × {modelCount}モデル = {totalSteps}ステップ
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
                      約{estMinutes}分
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* 進捗バー */}
          {survey && survey.status === "running" && (
            <div className="space-y-4 p-4 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20">
              {/* ヘッダー行 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="font-medium text-blue-700 dark:text-blue-400 text-sm">
                    調査進行中
                  </span>
                </div>
                <span className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                  {progressPercent}%
                </span>
              </div>

              {/* プログレスバー */}
              <Progress value={progressPercent} className="h-3" />

              {/* 詳細統計グリッド */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="text-center p-2 rounded-md bg-white/60 dark:bg-white/5">
                  <p className="text-xs text-muted-foreground">ステップ</p>
                  <p className="text-sm font-bold">{survey.doneSteps} / {survey.totalSteps}</p>
                </div>
                <div className="text-center p-2 rounded-md bg-white/60 dark:bg-white/5">
                  <p className="text-xs text-muted-foreground">経過時間</p>
                  <p className="text-sm font-bold">{formatTime(elapsedTime)}</p>
                </div>
                <div className="text-center p-2 rounded-md bg-white/60 dark:bg-white/5">
                  <p className="text-xs text-muted-foreground">残り時間（推定）</p>
                  <p className="text-sm font-bold text-blue-700 dark:text-blue-400">
                    {estimatedRemaining !== null
                      ? `約${formatTime(estimatedRemaining)}`
                      : survey.totalSteps > 0
                        ? `約${formatTime(Math.round((survey.totalSteps - survey.doneSteps) * AVG_SECONDS_PER_STEP))}`
                        : "計算中..."
                    }
                  </p>
                </div>
                <div className="text-center p-2 rounded-md bg-white/60 dark:bg-white/5">
                  <p className="text-xs text-muted-foreground">処理速度</p>
                  <p className="text-sm font-bold">
                    {survey.doneSteps > 0 && elapsedTime > 0
                      ? `${(elapsedTime / survey.doneSteps).toFixed(1)}秒/step`
                      : "測定中..."
                    }
                  </p>
                </div>
              </div>

              {/* 完了予定時刻 */}
              {estimatedRemaining !== null && (
                <div className="text-center text-xs text-muted-foreground">
                  完了予定: {new Date(Date.now() + estimatedRemaining * 1000).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} 頃
                </div>
              )}

              {/* 処理済みバッジ */}
              {results.length > 0 && (
                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground mb-2">
                    処理済み ({results.length}/{survey.totalSteps}):
                  </p>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {results.map((r) => (
                      <Badge key={r.id} variant={r.error ? "destructive" : "outline"} className="text-xs">
                        {r.error ? "✗" : "✓"} P{(r.promptIndex ?? 0) + 1}-{r.modelVariant}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 完了表示 */}
          {survey && survey.status === "completed" && (() => {
            const errorResults = results.filter((r) => r.error);
            const okResults = results.filter((r) => !r.error);
            return (
              <div className="space-y-3">
                <div className="p-4 rounded-lg border bg-green-50/50 dark:bg-green-950/20">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 text-lg">✓</span>
                    <div>
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">調査完了</p>
                      <p className="text-xs text-muted-foreground">
                        {promptGroups.length}プロンプト × {results.length > 0 ? Math.round(results.length / promptGroups.length) : 0}モデル ・
                        成功: {okResults.length} / エラー: {errorResults.length}
                        {survey.completedAt && (
                          <> ・ {new Date(survey.completedAt).toLocaleString("ja-JP")}</>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                {errorResults.length > 0 && (
                  <div className="p-4 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
                      エラー ({errorResults.length}件)
                    </p>
                    <div className="space-y-1">
                      {errorResults.map((r) => {
                        const errMsg = (() => {
                          try {
                            const parsed = JSON.parse(r.error || "");
                            return parsed.error?.message || r.error?.slice(0, 100) || "";
                          } catch {
                            return r.error?.slice(0, 100) || "";
                          }
                        })();
                        return (
                          <div key={r.id} className="text-xs">
                            <span className="font-medium">P{(r.promptIndex ?? 0) + 1} {r.modelVariant}:</span>{" "}
                            <span className="text-muted-foreground">{errMsg}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* 失敗表示 */}
          {survey && survey.status === "failed" && (
            <div className="p-4 rounded-lg border bg-red-50/50 dark:bg-red-950/20">
              <div className="flex items-center gap-2">
                <span className="text-red-600 text-lg">✗</span>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">調査失敗</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* プロンプトごとの結果 */}
      {promptGroups.map(([pIdx, group]) => (
        <div key={pIdx} className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-sm">プロンプト {pIdx + 1}</Badge>
            <span className="text-sm text-muted-foreground truncate">{group.promptText}</span>
          </div>

          {/* サービス言及状況テーブル */}
          {targetServices.length > 0 && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base">テキスト言及状況</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10">テキスト言及</TableHead>
                      {group.results.map((r) => (
                        <TableHead key={r.id} className="text-center whitespace-nowrap text-xs">
                          {r.modelVariant}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {targetServices.map((svc) => (
                      <TableRow key={svc}>
                        <TableCell className="sticky left-0 bg-background z-10 font-medium">{svc}</TableCell>
                        {group.results.map((r) => {
                          const mentions: Record<string, boolean> = JSON.parse(r.serviceMentions);
                          return (
                            <TableCell key={r.id} className="text-center">
                              {r.error ? (
                                <span className="text-red-500 text-xs">ERR</span>
                              ) : mentions[svc] ? (
                                <span className="text-green-600 font-bold">◯</span>
                              ) : (
                                <span className="text-muted-foreground">×</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                    {/* サイト引用行 */}
                    {project?.targetDomain && (
                      <TableRow>
                        <TableCell className="sticky left-0 bg-background z-10 font-medium">
                          {project.targetDomain} (引用)
                        </TableCell>
                        {group.results.map((r) => (
                          <TableCell key={r.id} className="text-center">
                            {r.error ? (
                              <span className="text-red-500 text-xs">ERR</span>
                            ) : r.targetDomainCited ? (
                              <span className="text-green-600 font-bold">◯</span>
                            ) : (
                              <span className="text-muted-foreground">×</span>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* 回答詳細 */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">回答詳細</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {group.results.map((r) => {
                const mentions: Record<string, boolean> = JSON.parse(r.serviceMentions);
                const mentionedServices = Object.entries(mentions).filter(([, v]) => v).map(([k]) => k);
                const urls: string[] = JSON.parse(r.citedUrls);
                const isExpanded = expandedModels.has(r.id);
                const providerColor = PROVIDER_COLORS[r.provider] || "";

                return (
                  <div key={r.id} className="border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                      onClick={() => !r.error && toggleExpand(r.id)}
                      disabled={!!r.error}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge className={`text-xs shrink-0 ${providerColor}`}>{r.provider}</Badge>
                        <span className="font-medium text-sm truncate">{r.modelVariant}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {r.error ? (
                          <Badge variant="destructive" className="text-xs">ERR</Badge>
                        ) : (
                          <>
                            {mentionedServices.length > 0 ? (
                              <Badge variant="default" className="text-xs bg-green-600">
                                {mentionedServices.length}件言及
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">言及なし</Badge>
                            )}
                            {urls.length > 0 && (
                              <Badge variant="outline" className="text-xs">{urls.length} URL</Badge>
                            )}
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            >
                              <path d="m6 9 6 6 6-6" />
                            </svg>
                          </>
                        )}
                      </div>
                    </button>

                    {isExpanded && !r.error && (
                      <div className="border-t px-4 py-3 space-y-4 bg-muted/20">
                        {/* 言及サービス */}
                        <div>
                          <h5 className="text-xs font-medium text-muted-foreground mb-1.5">言及サービス</h5>
                          <div className="flex flex-wrap gap-1">
                            {targetServices.map((svc) => (
                              <Badge
                                key={svc}
                                variant={mentions[svc] ? "default" : "secondary"}
                                className={`text-xs ${mentions[svc] ? "bg-green-600" : "opacity-50"}`}
                              >
                                {mentions[svc] ? "◯" : "×"} {svc}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* 引用リンク */}
                        {urls.length > 0 && (
                          <div>
                            <h5 className="text-xs font-medium text-muted-foreground mb-1.5">
                              引用リンク ({urls.length}件)
                            </h5>
                            <ul className="space-y-1">
                              {urls.map((url, i) => {
                                let hostname = "";
                                try { hostname = new URL(url).hostname; } catch { hostname = url; }
                                return (
                                  <li key={i} className="flex items-start gap-2 text-xs">
                                    <span className="text-muted-foreground shrink-0 mt-0.5">{i + 1}.</span>
                                    <div className="min-w-0">
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400"
                                      >
                                        {hostname}
                                      </a>
                                      <p className="text-muted-foreground truncate">{url}</p>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}

                        {/* 回答テキスト */}
                        <div>
                          <h5 className="text-xs font-medium text-muted-foreground mb-1.5">回答テキスト</h5>
                          <div
                            className="text-xs leading-relaxed whitespace-pre-wrap bg-background border rounded-md p-3 max-h-64 overflow-y-auto"
                            dangerouslySetInnerHTML={{
                              __html: highlightServices(r.responseText, targetServices),
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
