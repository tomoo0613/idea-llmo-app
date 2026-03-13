import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateFullExcel } from "@/lib/excel-exporter";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 全データを並列取得
  const [survey, analysis, diagnosis, recommendations] = await Promise.all([
    prisma.survey.findFirst({
      where: { projectId, status: "completed" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.analysis.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.diagnosis.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.recommendation.findMany({
      where: { projectId },
      orderBy: { priority: "asc" },
    }),
  ]);

  // 調査結果（あれば）
  const surveyResults = survey
    ? await prisma.surveyResult.findMany({
        where: { surveyId: survey.id },
        orderBy: [{ promptIndex: "asc" }, { modelVariant: "asc" }],
      })
    : [];

  const targetServices: string[] = JSON.parse(project.targetServices || "[]");

  const buffer = generateFullExcel({
    project: {
      name: project.name,
      description: project.description,
      prompt: project.prompt,
      targetDomain: project.targetDomain,
      targetServices,
      targetCustomer: project.targetCustomer,
      ruleMaking: project.ruleMaking,
      createdAt: project.createdAt.toISOString(),
    },
    surveyResults,
    analysis,
    diagnosis,
    recommendations,
  });

  const now = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  const filename = `${project.name}_LLMO分析レポート_${now}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
