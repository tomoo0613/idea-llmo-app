import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  let settings = await prisma.appSettings.findUnique({
    where: { id: "singleton" },
  });
  if (!settings) {
    settings = await prisma.appSettings.create({
      data: { id: "singleton" },
    });
  }
  // マスクして返す
  return NextResponse.json({
    openaiApiKey: settings.openaiApiKey ? mask(settings.openaiApiKey) : "",
    geminiApiKey: settings.geminiApiKey ? mask(settings.geminiApiKey) : "",
    claudeApiKey: settings.claudeApiKey ? mask(settings.claudeApiKey) : "",
    hasOpenai: !!settings.openaiApiKey,
    hasGemini: !!settings.geminiApiKey,
    hasClaude: !!settings.claudeApiKey,
  });
}

export async function PUT(request: Request) {
  const body = await request.json();

  const data: Record<string, string> = {};
  // 空でないフィールドのみ更新（マスクされた値は無視）
  if (body.openaiApiKey && !body.openaiApiKey.includes("***")) {
    data.openaiApiKey = body.openaiApiKey;
  }
  if (body.geminiApiKey && !body.geminiApiKey.includes("***")) {
    data.geminiApiKey = body.geminiApiKey;
  }
  if (body.claudeApiKey && !body.claudeApiKey.includes("***")) {
    data.claudeApiKey = body.claudeApiKey;
  }

  const settings = await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });

  return NextResponse.json({
    openaiApiKey: settings.openaiApiKey ? mask(settings.openaiApiKey) : "",
    geminiApiKey: settings.geminiApiKey ? mask(settings.geminiApiKey) : "",
    claudeApiKey: settings.claudeApiKey ? mask(settings.claudeApiKey) : "",
    hasOpenai: !!settings.openaiApiKey,
    hasGemini: !!settings.geminiApiKey,
    hasClaude: !!settings.claudeApiKey,
  });
}

function mask(key: string): string {
  if (key.length <= 8) return "***";
  return key.slice(0, 4) + "***" + key.slice(-4);
}
