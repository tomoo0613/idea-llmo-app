import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { surveys: true } },
      analyses: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const totalProjects = projects.length;
  const totalSurveys = projects.reduce((sum, p) => sum + p._count.surveys, 0);
  const projectsWithAnalysis = projects.filter((p) => p.analyses.length > 0);
  const avgScore =
    projectsWithAnalysis.length > 0
      ? projectsWithAnalysis.reduce(
          (sum, p) => sum + (p.analyses[0]?.overallScore || 0),
          0
        ) / projectsWithAnalysis.length
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <Link href="/projects/new">
          <Button>新規プロジェクト</Button>
        </Link>
      </div>

      {/* サマリーカード */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              プロジェクト数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{totalProjects}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              総調査回数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{totalSurveys}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              平均スコア
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">
              {avgScore > 0 ? Math.round(avgScore) : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* プロジェクト一覧 */}
      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              プロジェクトを作成して、AI検索での表示状況を調査しましょう。
            </p>
            <Link href="/projects/new">
              <Button>最初のプロジェクトを作成</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div>
          <h2 className="text-lg font-semibold mb-3">最近のプロジェクト</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const analysis = project.analyses[0];
              const services: string[] = (() => {
                try { return JSON.parse(project.targetServices); } catch { return []; }
              })();
              return (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                    <CardHeader>
                      <CardTitle className="text-base">{project.name}</CardTitle>
                      <div className="flex flex-wrap gap-1">
                        {project.targetDomain && (
                          <Badge variant="outline" className="w-fit">
                            {project.targetDomain}
                          </Badge>
                        )}
                        {services.slice(0, 2).map((s, i) => (
                          <Badge key={i} variant="secondary" className="w-fit">
                            {s}
                          </Badge>
                        ))}
                        {services.length > 2 && (
                          <Badge variant="secondary" className="w-fit">
                            +{services.length - 2}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          <p>調査: {project._count.surveys}回</p>
                        </div>
                        {analysis && (
                          <div className="text-right">
                            <p className="text-3xl font-bold">
                              {Math.round(analysis.overallScore)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              スコア
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
