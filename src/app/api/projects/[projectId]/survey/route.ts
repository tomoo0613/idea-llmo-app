import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeSurvey } from "@/lib/ai/survey-executor";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const survey = await prisma.survey.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  if (!survey) {
    return NextResponse.json({ survey: null, results: [] });
  }

  const results = await prisma.surveyResult.findMany({
    where: { surveyId: survey.id },
    orderBy: [{ promptIndex: "asc" }, { modelVariant: "asc" }],
  });

  return NextResponse.json({ survey, results });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const settings = await prisma.appSettings.findUnique({
    where: { id: "singleton" },
  });

  const openaiApiKey = settings?.openaiApiKey || process.env.OPENAI_API_KEY || null;
  const geminiApiKey = settings?.geminiApiKey || process.env.GEMINI_API_KEY || null;
  const claudeApiKey = settings?.claudeApiKey || process.env.ANTHROPIC_API_KEY || null;

  if (!openaiApiKey && !geminiApiKey && !claudeApiKey) {
    return NextResponse.json(
      { error: "少なくとも1つのAPIキーを設定してください" },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) {
    return NextResponse.json({ error: "プロジェクトが見つかりません" }, { status: 404 });
  }
  if (!project.prompt) {
    return NextResponse.json({ error: "調査プロンプトを設定してください" }, { status: 400 });
  }

  const targetServices: string[] = JSON.parse(project.targetServices || "[]");

  const survey = await prisma.survey.create({
    data: { projectId, status: "pending" },
  });

  // バックグラウンドで実行
  executeSurvey({
    surveyId: survey.id,
    projectId,
    prompt: project.prompt,
    targetDomain: project.targetDomain,
    targetServices,
    openaiApiKey,
    geminiApiKey,
    claudeApiKey,
  }).catch(console.error);

  return NextResponse.json({ survey }, { status: 201 });
}
