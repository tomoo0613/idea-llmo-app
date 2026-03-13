"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface Recommendation {
  id: string;
  priority: number;
  category: string;
  title: string;
  description: string;
  rationale: string;
  suggestedContent: string | null;
  targetPrompts: string | null;
  status: string;
}

const categoryLabels: Record<string, string> = {
  "research-pr": "リサピー®（調査PR）",
  whitepaper: "ハクピー®（白書）",
  report: "レポピー®（レポート）",
  column: "コラピー®（コラム）",
  "structured-data": "構造化データ",
  // 旧カテゴリとの後方互換
  content: "コンテンツ",
  faq: "FAQ",
  brand: "ブランド",
  seo: "SEO",
};

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "未着手", variant: "secondary" },
  in_progress: { label: "対応中", variant: "default" },
  completed: { label: "完了", variant: "outline" },
  dismissed: { label: "見送り", variant: "destructive" },
};

export default function ActionPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/action`)
      .then((res) => res.json())
      .then(setRecommendations)
      .finally(() => setLoading(false));
  }, [projectId]);

  async function generateActions() {
    setGenerating(true);
    const res = await fetch(`/api/projects/${projectId}/action`, {
      method: "POST",
    });
    const data = await res.json();
    if (res.ok) {
      setRecommendations(data);
      toast.success("対策提案を生成しました");
    } else {
      toast.error(data.error || "生成に失敗しました");
    }
    setGenerating(false);
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/projects/${projectId}/action`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      setRecommendations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
    }
  }

  if (loading) return <p className="text-muted-foreground">読み込み中...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button onClick={generateActions} disabled={generating}>
          {generating ? "生成中..." : "対策提案を生成"}
        </Button>
        <span className="text-sm text-muted-foreground">
          分析結果に基づいてAIがコンテンツ戦略を提案します
        </span>
      </div>

      {recommendations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              分析を実行後、対策提案を生成してください
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {recommendations.map((rec) => {
            const isExpanded = expandedId === rec.id;
            const statusInfo = statusLabels[rec.status] || statusLabels.pending;
            const targets: string[] = rec.targetPrompts
              ? JSON.parse(rec.targetPrompts)
              : [];

            return (
              <Card key={rec.id}>
                <CardHeader
                  className="cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                        {rec.priority}
                      </span>
                      <div>
                        <CardTitle className="text-base">
                          {rec.title}
                        </CardTitle>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline">
                            {categoryLabels[rec.category] || rec.category}
                          </Badge>
                          <Badge variant={statusInfo.variant}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <span className="text-muted-foreground text-sm">
                      {isExpanded ? "閉じる" : "詳細"}
                    </span>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-1">説明</h4>
                      <p className="text-sm">{rec.description}</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-1">根拠</h4>
                      <p className="text-sm text-muted-foreground">
                        {rec.rationale}
                      </p>
                    </div>

                    {rec.suggestedContent && (
                      <div>
                        <h4 className="text-sm font-medium mb-1">
                          推奨コンテンツ（ドラフト）
                        </h4>
                        <div className="bg-muted p-4 rounded-md text-sm whitespace-pre-wrap">
                          {rec.suggestedContent}
                        </div>
                      </div>
                    )}

                    {targets.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-1">対象プロンプト</h4>
                        <ul className="list-disc list-inside text-sm text-muted-foreground">
                          {targets.map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <Separator />

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={rec.status === "in_progress" ? "default" : "outline"}
                        onClick={() => updateStatus(rec.id, "in_progress")}
                      >
                        対応中
                      </Button>
                      <Button
                        size="sm"
                        variant={rec.status === "completed" ? "default" : "outline"}
                        onClick={() => updateStatus(rec.id, "completed")}
                      >
                        完了
                      </Button>
                      <Button
                        size="sm"
                        variant={rec.status === "dismissed" ? "destructive" : "outline"}
                        onClick={() => updateStatus(rec.id, "dismissed")}
                      >
                        見送り
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
