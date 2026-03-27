"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Palette,
  Users,
  CreditCard,
  Landmark,
  Globe,
  FileSignature,
  Link2,
  Shield,
  ScrollText,
  Database,
  AlertTriangle,
} from "lucide-react";

type NavItem = {
  key: string;
  label: string;
  segment: string;
  icon: typeof Building2;
};

type NavSection = {
  heading: string;
  items: NavItem[];
};

const sections: NavSection[] = [
  {
    heading: "Organization",
    items: [
      { key: "general", label: "General", segment: "", icon: Building2 },
      { key: "appearance", label: "Appearance", segment: "/appearance", icon: Palette },
      { key: "team", label: "Team", segment: "/team", icon: Users },
    ],
  },
  {
    heading: "Billing",
    items: [
      { key: "billing", label: "Plans & Billing", segment: "/billing", icon: CreditCard },
    ],
  },
  {
    heading: "Connections",
    items: [
      { key: "financial-connections", label: "Financials", segment: "/connections/financials", icon: Landmark },
      { key: "listing-connections", label: "Listing Websites", segment: "/connections/listings", icon: Globe },
      { key: "document-connections", label: "Documents", segment: "/connections/documents", icon: FileSignature },
    ],
  },
  {
    heading: "Security & Compliance",
    items: [
      { key: "security", label: "Security", segment: "/security", icon: Shield },
      { key: "audit", label: "Audit Log", segment: "/audit", icon: ScrollText },
    ],
  },
  {
    heading: "Advanced",
    items: [
      { key: "data", label: "Data & Export", segment: "/data", icon: Database },
      { key: "danger", label: "Danger Zone", segment: "/danger", icon: AlertTriangle },
    ],
  },
];

export function OrgSettingsNav({ orgId }: Readonly<{ orgId: string }>) {
  const pathname = usePathname();
  const base = `/organizations/${orgId}/settings`;

  return (
    <>
      {/* Desktop: vertical sidebar nav */}
      <nav
        aria-label="Settings sections"
        className="hidden w-56 shrink-0 lg:block"
      >
        <div className="space-y-5">
          {sections.map((section) => (
            <div key={section.heading}>
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-zinc-500">
                {section.heading}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const href = `${base}${item.segment}`;
                  const isActive =
                    item.segment === ""
                      ? pathname === base || pathname === `${base}/`
                      : pathname.startsWith(href);
                  const Icon = item.icon;

                  return (
                    <li key={item.key}>
                      <Link
                        href={href}
                        aria-current={isActive ? "page" : undefined}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-stone-100 text-stone-900 dark:bg-zinc-800 dark:text-white"
                            : "text-stone-600 hover:bg-stone-50 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-white"
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${
                          isActive
                            ? "text-indigo-600 dark:text-indigo-400"
                            : "text-stone-400 dark:text-zinc-500"
                        }`} />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* Mobile / tablet: horizontal scrollable nav */}
      <nav
        aria-label="Settings sections"
        className="mb-4 -mx-1 overflow-x-auto lg:hidden"
      >
        <div className="flex gap-1 rounded-xl border border-stone-200 bg-stone-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {sections.flatMap((s) => s.items).map((item) => {
            const href = `${base}${item.segment}`;
            const isActive =
              item.segment === ""
                ? pathname === base || pathname === `${base}/`
                : pathname.startsWith(href);
            const Icon = item.icon;

            return (
              <Link
                key={item.key}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-white text-stone-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                    : "text-stone-500 hover:text-stone-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
