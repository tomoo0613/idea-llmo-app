"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Project {
  id: string;
  name: string;
  description: string | null;
  prompt: string;
  targetDomain: string;
  targetServices: string;
  targetCustomer: string;
  ruleMaking: string;
  createdAt: string;
  _count: { surveys: number };
}

export default function ProjectOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((res) => res.json())
      .then(setProject);
  }, [projectId]);

  async function handleDelete() {
    if (!confirm("このプロジェクトを削除しますか？")) return;
    await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    router.push("/projects");
  }

  if (!project) return <p className="text-muted-foreground">読み込み中...</p>;

  const targetServices: string[] = (() => {
    try { return JSON.parse(project.targetServices); } catch { return []; }
  })();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              調査回数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{project._count.surveys}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              対象ドメイン
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg">{project.targetDomain || "未設定"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              作成日
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg">
              {new Date(project.createdAt).toLocaleDateString("ja-JP")}
            </p>
          </CardContent>
        </Card>
      </div>

      {project.description && (
        <Card>
          <CardHeader>
            <CardTitle>説明</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{project.description}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>調査プロンプト</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">
            {project.prompt || "未設定"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>調査テキスト言及</CardTitle>
        </CardHeader>
        <CardContent>
          {targetServices.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {targetServices.map((s, i) => (
                <Badge key={i} variant="secondary">{s}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">未設定</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ターゲット顧客</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap">
            {project.targetCustomer || "未設定"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ルールメイク（条件設定）</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap">
            {project.ruleMaking || "未設定"}
          </p>
        </CardContent>
      </Card>

      <div className="pt-4">
        <Button variant="destructive" onClick={handleDelete}>
          プロジェクトを削除
        </Button>
      </div>
    </div>
  );
}
