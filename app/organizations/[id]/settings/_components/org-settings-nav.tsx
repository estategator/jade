"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { key: "general", label: "General", segment: "" },
  { key: "appearance", label: "Appearance", segment: "/appearance" },
  { key: "team", label: "Team & Invitations", segment: "/team" },
  { key: "billing", label: "Billing & Stripe", segment: "/billing" },
] as const;

export function OrgSettingsNav({ orgId }: Readonly<{ orgId: string }>) {
  const pathname = usePathname();
  const base = `/organizations/${orgId}/settings`;

  return (
    <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-stone-200 bg-stone-100 p-1 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-4">
      {tabs.map((t) => {
        const href = `${base}${t.segment}`;
        const isActive =
          t.segment === ""
            ? pathname === base || pathname === `${base}/`
            : pathname.startsWith(href);

        return (
          <Link
            key={t.key}
            href={href}
            className={`flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium transition-all ${
              isActive
                ? "bg-white text-stone-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                : "text-stone-500 hover:text-stone-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
