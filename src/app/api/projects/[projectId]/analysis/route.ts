import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const analysis = await prisma.analysis.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(analysis);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) {
    return NextResponse.json({ error: "プロジェクトが見つかりません" }, { status: 404 });
  }

  // 最新の完了した調査を取得
  const survey = await prisma.survey.findFirst({
    where: { projectId, status: "completed" },
    orderBy: { createdAt: "desc" },
  });

  if (!survey) {
    return NextResponse.json(
      { error: "完了した調査がありません" },
      { status: 400 }
    );
  }

  const results = await prisma.surveyResult.findMany({
    where: { surveyId: survey.id },
  });

  if (results.length === 0) {
    return NextResponse.json(
      { error: "調査結果がありません" },
      { status: 400 }
    );
  }

  const targetServices: string[] = JSON.parse(project.targetServices || "[]");
  const validResults = results.filter((r) => !r.error);

  // プロバイダー別スコア計算
  // 新スキーマでのスコアリング: サービス言及率 + ドメイン引用率
  function calcScore(resultSubset: typeof validResults): number {
    if (resultSubset.length === 0) return 0;

    let totalScore = 0;
    for (const r of resultSubset) {
      let score = 0;
      const mentions: Record<string, boolean> = JSON.parse(r.serviceMentions);
      const mentionedCount = Object.values(mentions).filter(Boolean).length;
      const totalServices = Math.max(Object.keys(mentions).length, 1);

      // サービス言及率: 60点分
      score += (mentionedCount / totalServices) * 60;

      // ドメイン引用: 30点分
      if (r.targetDomainCited) score += 30;

      // URL引用あり: 10点分
      const urls: string[] = JSON.parse(r.citedUrls);
      if (urls.length > 0) score += 10;

      totalScore += score;
    }
    return totalScore / resultSubset.length;
  }

  const byProvider = (provider: string) =>
    validResults.filter((r) => r.provider === provider);

  const openaiScore = calcScore(byProvider("openai"));
  const geminiScore = calcScore(byProvider("gemini"));
  const claudeScore = calcScore(byProvider("claude"));
  const overallScore = calcScore(validResults);

  // カバレッジ: サービスが1つでも言及されたモデルの割合
  const keywordCoverage = validResults.length > 0
    ? validResults.filter((r) => {
        const mentions: Record<string, boolean> = JSON.parse(r.serviceMentions);
        return Object.values(mentions).some(Boolean);
      }).length / validResults.length
    : 0;

  // サイテーション率: ドメインが引用されたモデルの割合
  const citationRate = validResults.length > 0
    ? validResults.filter((r) => r.targetDomainCited).length / validResults.length
    : 0;

  // モデル別スコア
  const modelScores: Record<string, { modelVariant: string; provider: string; score: number; serviceMentions: Record<string, boolean>; domainCited: boolean; hasUrlCitation: boolean }> = {};
  for (const r of results) {
    const mentions: Record<string, boolean> = JSON.parse(r.serviceMentions);
    const mentionedCount = Object.values(mentions).filter(Boolean).length;
    const totalSvcs = Math.max(Object.keys(mentions).length, 1);
    const urls: string[] = JSON.parse(r.citedUrls);
    let score = 0;
    if (!r.error) {
      score += (mentionedCount / totalSvcs) * 60;
      if (r.targetDomainCited) score += 30;
      if (urls.length > 0) score += 10;
    }
    modelScores[r.modelVariant] = {
      modelVariant: r.modelVariant,
      provider: r.provider,
      score,
      serviceMentions: mentions,
      domainCited: r.targetDomainCited,
      hasUrlCitation: urls.length > 0,
    };
  }

  // 強み・弱みの特定
  const sortedModels = Object.values(modelScores).sort((a, b) => b.score - a.score);
  const strengths = sortedModels
    .filter((m) => m.score >= 50)
    .slice(0, 3)
    .map((m) => `${m.modelVariant}: スコア ${m.score.toFixed(0)}`);
  const weaknesses = sortedModels
    .filter((m) => m.score < 50)
    .slice(-3)
    .map((m) => `${m.modelVariant}: スコア ${m.score.toFixed(0)}`);

  // メンション内訳（サービス別: いくつのモデルで言及されたか）
  const mentionBreakdown: Record<string, number> = {};
  for (const svc of targetServices) {
    mentionBreakdown[svc] = validResults.filter((r) => {
      const mentions: Record<string, boolean> = JSON.parse(r.serviceMentions);
      return mentions[svc];
    }).length;
  }

  const analysis = await prisma.analysis.create({
    data: {
      projectId,
      surveyId: survey.id,
      overallScore,
      openaiScore,
      geminiScore,
      claudeScore,
      keywordCoverage,
      citationRate,
      avgPosition: null,
      mentionBreakdown: JSON.stringify(mentionBreakdown),
      promptScores: JSON.stringify(modelScores),
      strengths: JSON.stringify(strengths),
      weaknesses: JSON.stringify(weaknesses),
    },
  });

  return NextResponse.json(analysis, { status: 201 });
}
