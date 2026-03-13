"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewProjectPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState<string[]>([""]);

  function addService() {
    setServices([...services, ""]);
  }
  function removeService(idx: number) {
    setServices(services.filter((_, i) => i !== idx));
  }
  function updateService(idx: number, value: string) {
    const updated = [...services];
    updated[idx] = value;
    setServices(updated);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const body = {
      name: formData.get("name"),
      description: formData.get("description"),
      prompt: formData.get("prompt"),
      targetDomain: formData.get("targetDomain"),
      targetServices: services.filter((s) => s.trim() !== ""),
      targetCustomer: formData.get("targetCustomer"),
      ruleMaking: formData.get("ruleMaking"),
    };

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const project = await res.json();
      router.push(`/projects/${project.id}/survey`);
    } else {
      setSaving(false);
      alert("プロジェクトの作成に失敗しました");
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">新規プロジェクト作成</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">
                プロジェクト名 *
              </label>
              <Input name="name" required placeholder="例: PR調査サービスのLLMO調査" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">説明</label>
              <Textarea
                name="description"
                placeholder="プロジェクトの概要を入力"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>調査プロンプト</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="text-sm font-medium mb-1 block">
              各AIに送信するプロンプト *
            </label>
            <Textarea
              name="prompt"
              required
              placeholder="例: PRで大手企業向きのサービスを教えてください。"
              rows={3}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>調査対象</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">
                調査対象サイト（ドメイン）
              </label>
              <Input
                name="targetDomain"
                placeholder="例: ideatech.jp"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                調査テキスト言及（複数可）
              </label>
              <div className="space-y-2">
                {services.map((svc, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={svc}
                      onChange={(e) => updateService(i, e.target.value)}
                      placeholder={`テキスト言及 ${i + 1}`}
                      className="flex-1"
                    />
                    {services.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeService(i)}
                      >
                        削除
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addService}
                >
                  + テキスト言及を追加
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ターゲット顧客</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              name="targetCustomer"
              placeholder="どのような顧客をターゲットにしていますか？"
              rows={3}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ルールメイク（条件設定）</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              name="ruleMaking"
              placeholder="AIにどのような形で選ばれたいですか？"
              rows={3}
            />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "作成中..." : "プロジェクトを作成"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            キャンセル
          </Button>
        </div>
      </form>
    </div>
  );
}
