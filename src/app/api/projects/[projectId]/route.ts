import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      _count: { select: { surveys: true } },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await request.json();
  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      name: body.name,
      description: body.description,
      prompt: body.prompt,
      targetDomain: body.targetDomain,
      targetServices: JSON.stringify(body.targetServices || []),
      targetCustomer: body.targetCustomer,
      ruleMaking: body.ruleMaking,
    },
  });
  return NextResponse.json(project);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  await prisma.project.delete({ where: { id: projectId } });
  return NextResponse.json({ success: true });
}
