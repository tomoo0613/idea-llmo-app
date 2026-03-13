import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateExcel } from "@/lib/excel-exporter";

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
    orderBy: [{ promptIndex: "asc" }, { modelVariant: "asc" }],
  });

  const targetServices: string[] = JSON.parse(project.targetServices || "[]");

  const buffer = generateExcel({
    prompt: project.prompt,
    targetDomain: project.targetDomain,
    targetServices,
    results,
  });

  const now = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  const filename = `${now}_LLMモニタリング.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
