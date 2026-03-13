"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  targetDomain: string;
}

const tabs = [
  { href: "", label: "概要" },
  { href: "/survey", label: "調査" },
  { href: "/analysis", label: "分析" },
  { href: "/diagnosis", label: "基礎診断" },
  { href: "/action", label: "対策" },
  { href: "/output", label: "出力" },
];

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { projectId } = useParams<{ projectId: string }>();
  const pathname = usePathname();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((res) => res.json())
      .then(setProject);
  }, [projectId]);

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/projects"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; プロジェクト一覧
        </Link>
        {project && (
          <div className="mt-2">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              ドメイン: {project.targetDomain || "未設定"}
            </p>
          </div>
        )}
      </div>

      <nav className="flex gap-1 border-b mb-6">
        {tabs.map((tab) => {
          const fullHref = `/projects/${projectId}${tab.href}`;
          const isActive =
            tab.href === ""
              ? pathname === fullHref
              : pathname.startsWith(fullHref);
          return (
            <Link
              key={tab.href}
              href={fullHref}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
