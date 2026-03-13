import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { surveys: true } },
    },
  });
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const body = await request.json();
  const project = await prisma.project.create({
    data: {
      name: body.name,
      description: body.description || null,
      prompt: body.prompt || "",
      targetDomain: body.targetDomain || "",
      targetServices: JSON.stringify(body.targetServices || []),
      targetCustomer: body.targetCustomer || "",
      ruleMaking: body.ruleMaking || "",
    },
  });
  return NextResponse.json(project, { status: 201 });
}
