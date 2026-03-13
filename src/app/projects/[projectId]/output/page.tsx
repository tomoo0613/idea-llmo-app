"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function OutputPage() {
  const { projectId } = useParams<{ projectId: string }>();

  async function handleExportExcel() {
    toast.info("Excelファイルを生成中...");
    try {
      const res = await fetch(`/api/projects/${projectId}/export`);
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "エクスポートに失敗しました");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename\*=UTF-8''(.+)/);
      const filename = match ? decodeURIComponent(match[1]) : "LLMO分析レポート.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excelファイルをダウンロードしました");
    } catch {
      toast.error("ダウンロードに失敗しました");
    }
  }

  async function handleExportDocx() {
    toast.info("Word提案書を生成中...");
    try {
      const res = await fetch(`/api/projects/${projectId}/export-docx`);
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "エクスポートに失敗しました");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename\*=UTF-8''(.+)/);
      const filename = match ? decodeURIComponent(match[1]) : "LLMO提案書.docx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Word提案書をダウンロードしました");
    } catch {
      toast.error("ダウンロードに失敗しました");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>データ出力</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            プロジェクトの調査・分析・診断・対策データをファイルとしてエクスポートします。
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="text-2xl">📊</span>
                  全データExcel出力
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  概要・調査結果・テキスト言及状況・引用ページ・分析・基礎診断・対策提案を各シートにまとめたExcelファイルを出力します。
                </p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>・概要シート（プロジェクト情報）</li>
                  <li>・調査内容シート（プロンプト一覧）</li>
                  <li>・テキスト言及状況シート</li>
                  <li>・引用ページシート（ドメイン別・モデル別）</li>
                  <li>・分析シート（スコア・カバレッジ）</li>
                  <li>・基礎診断シート（20項目評価）</li>
                  <li>・対策提案シート</li>
                </ul>
                <Button onClick={handleExportExcel} className="w-full">
                  📥 全データExcel出力
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="text-2xl">📝</span>
                  Word提案書出力
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  分析結果をもとにした提案書をWord形式で出力します。クライアントへの提出用にご利用ください。
                </p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>・表紙・目次</li>
                  <li>・エグゼクティブサマリー</li>
                  <li>・プロジェクト概要</li>
                  <li>・分析結果（スコア・カバレッジ）</li>
                  <li>・基礎診断結果</li>
                  <li>・対策提案（優先度順）</li>
                </ul>
                <Button onClick={handleExportDocx} className="w-full">
                  📄 Word提案書出力
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
