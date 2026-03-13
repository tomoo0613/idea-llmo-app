"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  description: string | null;
  prompt: string;
  targetDomain: string;
  targetServices: string;
  createdAt: string;
  updatedAt: string;
  _count: { surveys: number };
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(e: React.MouseEvent, project: Project) {
    e.preventDefault(); // Linkのナビゲーションを防止
    e.stopPropagation();

    if (!confirm(`プロジェクト「${project.name}」を削除しますか？\n関連する調査データもすべて削除されます。`)) {
      return;
    }

    setDeletingId(project.id);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== project.id));
        toast.success("プロジェクトを削除しました");
      } else {
        toast.error("削除に失敗しました");
      }
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">プロジェクト一覧</h1>
        <Link href="/projects/new">
          <Button>新規プロジェクト</Button>
        </Link>
      </div>

      {loading ? (
        <p className="text-muted-foreground">読み込み中...</p>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              プロジェクトがまだありません
            </p>
            <Link href="/projects/new">
              <Button>最初のプロジェクトを作成</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const services: string[] = (() => {
              try { return JSON.parse(project.targetServices); } catch { return []; }
            })();
            const isDeleting = deletingId === project.id;
            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className={`hover:border-primary/50 transition-colors cursor-pointer relative ${isDeleting ? "opacity-50 pointer-events-none" : ""}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={(e) => handleDelete(e, project)}
                        disabled={isDeleting}
                        title="プロジェクトを削除"
                      >
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
                        >
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </Button>
                    </div>
                    {project.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {project.description}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-1 mb-3">
                      {project.targetDomain && (
                        <Badge variant="outline">{project.targetDomain}</Badge>
                      )}
                      {services.slice(0, 3).map((s, i) => (
                        <Badge key={i} variant="secondary">{s}</Badge>
                      ))}
                      {services.length > 3 && (
                        <Badge variant="secondary">+{services.length - 3}</Badge>
                      )}
                    </div>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>調査: {project._count.surveys}回</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
