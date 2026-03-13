import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateProposalDocx } from "@/lib/docx-exporter";

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

  const [analysis, diagnosis, recommendations] = await Promise.all([
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

  const targetServices: string[] = JSON.parse(project.targetServices || "[]");

  const buffer = await generateProposalDocx({
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
    analysis,
    diagnosis,
    recommendations,
  });

  const now = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  const filename = `${project.name}_LLMO提案書_${now}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
