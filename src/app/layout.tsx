import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/layout/sidebar";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "IDEA LLMO分析ツール",
  description: "LLM検索最適化のための調査・分析・対策ツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${notoSansJP.variable} font-sans antialiased`}>
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <div className="container mx-auto p-6">{children}</div>
          </main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
