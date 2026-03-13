import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateRecommendations } from "@/lib/action/content-generator";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const recommendations = await prisma.recommendation.findMany({
    where: { projectId },
    orderBy: { priority: "asc" },
  });
  return NextResponse.json(recommendations);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  // プロジェクト情報
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) {
    return NextResponse.json({ error: "プロジェクトが見つかりません" }, { status: 404 });
  }

  // 最新の分析結果を取得
  const analysis = await prisma.analysis.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  if (!analysis) {
    return NextResponse.json(
      { error: "分析結果がありません。先に分析を実行してください" },
      { status: 400 }
    );
  }

  // APIキーの取得（Claude APIを使用）
  const settings = await prisma.appSettings.findUnique({
    where: { id: "singleton" },
  });
  const claudeApiKey = settings?.claudeApiKey || process.env.ANTHROPIC_API_KEY;
  if (!claudeApiKey) {
    return NextResponse.json(
      { error: "Anthropic APIキーが必要です" },
      { status: 400 }
    );
  }

  const targetServices: string[] = JSON.parse(project.targetServices || "[]");
  const weaknesses: string[] = JSON.parse(analysis.weaknesses);
  const mentionBreakdown: Record<string, number> = JSON.parse(analysis.mentionBreakdown);

  // 言及が少ないサービスを特定
  const weakServices = targetServices.filter((svc) => {
    const count = mentionBreakdown[svc] || 0;
    return count < 5; // 9モデル中5未満は弱い
  });

  try {
    const recommendations = await generateRecommendations(
      {
        targetDomain: project.targetDomain,
        targetServices,
        targetCustomer: project.targetCustomer,
        ruleMaking: project.ruleMaking,
        overallScore: analysis.overallScore,
        weaknesses,
        keywordCoverage: analysis.keywordCoverage,
        citationRate: analysis.citationRate,
        weakServices,
      },
      claudeApiKey
    );

    // 既存の提案を削除して新規作成
    await prisma.recommendation.deleteMany({ where: { projectId } });

    const created = await prisma.$transaction(
      recommendations.map((rec) =>
        prisma.recommendation.create({
          data: {
            projectId,
            analysisId: analysis.id,
            priority: rec.priority,
            category: rec.category,
            title: rec.title,
            description: rec.description,
            rationale: rec.rationale,
            suggestedContent: rec.suggestedContent,
            targetPrompts: JSON.stringify(rec.targetPrompts),
            status: "pending",
          },
        })
      )
    );

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("Recommendation generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "生成に失敗しました" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { id, status } = body;
  const recommendation = await prisma.recommendation.update({
    where: { id },
    data: { status },
  });
  return NextResponse.json(recommendation);
}
