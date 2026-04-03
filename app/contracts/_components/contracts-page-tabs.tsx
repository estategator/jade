"use client";

import Link from "next/link";
import { FileText, LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/cn";

type Tab = "contracts" | "templates";

const tabs: { key: Tab; label: string; icon: typeof FileText; href: string }[] =
  [
    {
      key: "contracts",
      label: "Contracts",
      icon: FileText,
      href: "/contracts",
    },
    {
      key: "templates",
      label: "Templates",
      icon: LayoutTemplate,
      href: "/contracts?tab=templates",
    },
  ];

export function ContractsPageTabs({
  activeTab,
}: Readonly<{ activeTab: Tab }>) {
  return (
    <div className="mb-6 flex gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = activeTab === t.key;
        return (
          <Link
            key={t.key}
            href={t.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
              isActive
                ? "bg-white text-stone-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                : "text-stone-500 hover:text-stone-700 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
          >
            <Icon className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
