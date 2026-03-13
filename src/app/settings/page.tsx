"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Settings {
  openaiApiKey: string;
  geminiApiKey: string;
  claudeApiKey: string;
  hasOpenai: boolean;
  hasGemini: boolean;
  hasClaude: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [openai, setOpenai] = useState("");
  const [gemini, setGemini] = useState("");
  const [claude, setClaude] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data: Settings) => {
        setSettings(data);
        setOpenai(data.openaiApiKey);
        setGemini(data.geminiApiKey);
        setClaude(data.claudeApiKey);
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        openaiApiKey: openai,
        geminiApiKey: gemini,
        claudeApiKey: claude,
      }),
    });
    const data = await res.json();
    setSettings(data);
    setOpenai(data.openaiApiKey);
    setGemini(data.geminiApiKey);
    setClaude(data.claudeApiKey);
    setSaving(false);
    toast.success("設定を保存しました");
  }

  if (!settings) return <p className="text-muted-foreground">読み込み中...</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">設定</h1>

      <Card>
        <CardHeader>
          <CardTitle>APIキー設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-sm font-medium">OpenAI API Key</label>
              <Badge variant={settings.hasOpenai ? "default" : "secondary"}>
                {settings.hasOpenai ? "設定済" : "未設定"}
              </Badge>
            </div>
            <Input
              type="password"
              value={openai}
              onChange={(e) => setOpenai(e.target.value)}
              placeholder="sk-..."
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-sm font-medium">Google Gemini API Key</label>
              <Badge variant={settings.hasGemini ? "default" : "secondary"}>
                {settings.hasGemini ? "設定済" : "未設定"}
              </Badge>
            </div>
            <Input
              type="password"
              value={gemini}
              onChange={(e) => setGemini(e.target.value)}
              placeholder="AIza..."
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-sm font-medium">Anthropic API Key</label>
              <Badge variant={settings.hasClaude ? "default" : "secondary"}>
                {settings.hasClaude ? "設定済" : "未設定"}
              </Badge>
            </div>
            <Input
              type="password"
              value={claude}
              onChange={(e) => setClaude(e.target.value)}
              placeholder="sk-ant-..."
            />
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
