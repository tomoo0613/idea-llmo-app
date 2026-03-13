import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const diagnosis = await prisma.diagnosis.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(diagnosis);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await request.json();
  const { scores, notes } = body as {
    scores: Record<string, number>;
    notes: Record<string, string>;
  };

  // カテゴリ別スコア計算
  const catA = [1, 2, 3, 4, 5]; // 技術的要素・アクセシビリティ
  const catB = [6, 7, 8, 9, 10]; // 権威性・信頼性（E-E-A-T）
  const catC = [11, 12, 13, 14, 15]; // コンテンツ適合性
  const catD = [16, 17, 18, 19, 20]; // 外部評価・サイテーション

  const sumCategory = (items: number[]) =>
    items.reduce((sum, i) => sum + (scores[String(i)] || 0), 0);

  const categoryA = sumCategory(catA);
  const categoryB = sumCategory(catB);
  const categoryC = sumCategory(catC);
  const categoryD = sumCategory(catD);
  const totalScore = categoryA + categoryB + categoryC + categoryD;

  const diagnosis = await prisma.diagnosis.create({
    data: {
      projectId,
      scores: JSON.stringify(scores),
      notes: JSON.stringify(notes),
      totalScore,
      maxScore: 100, // 20項目 × 5点
      categoryA,
      categoryB,
      categoryC,
      categoryD,
    },
  });

  return NextResponse.json(diagnosis, { status: 201 });
}
