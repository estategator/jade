"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Package,
  Building2,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  TrendingUp,
  Bell,
  Megaphone,
  HelpCircle,
  Code2,
  Ticket,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { OrgSwitcher } from "@/app/components/org-switcher";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { cn } from "@/lib/cn";
import { useSidebar } from "@/lib/sidebar-context";
import { getUnreadNotificationCount } from "@/app/notifications/actions";
import { getProfileRole } from "@/app/developer/actions";

function Tooltip({
  children,
  label,
  show = true,
}: {
  children: React.ReactNode;
  label: string;
  show?: boolean;
}) {
  if (!show) return <>{children}</>;
  return (
    <div className="group/tip relative">
      {children}
      <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-all duration-200 group-hover/tip:opacity-100 dark:bg-stone-100 dark:text-stone-900">
        <div className="absolute -left-1 top-1/2 -translate-y-1/2 border-4 border-transparent border-r-zinc-900 dark:border-r-stone-100" />
        {label}
      </div>
    </div>
  );
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export function Sidebar() {
  const { isExpanded, toggle } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isDeveloper, setIsDeveloper] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadCount() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      const [notifResult, role] = await Promise.all([
        getUnreadNotificationCount(session.user.id),
        getProfileRole(session.user.id),
      ]);
      if (!cancelled) {
        setUnreadCount(notifResult.count);
        setIsDeveloper(role === "developer");
      }
    }
    loadCount();
    const interval = setInterval(loadCount, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const navSections: NavSection[] = [
    {
      title: "Core",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: BarChart3 },
        { label: "Inventory", href: "/inventory", icon: Package },
        { label: "Pricing", href: "/pricing-optimization", icon: TrendingUp },
        { label: "Marketing", href: "/marketing", icon: Megaphone },
      ],
    },
    {
      title: "Manage",
      items: [
        {
          label: "Notifications",
          href: "/notifications",
          icon: Bell,
          badge: unreadCount,
        },
        { label: "Organizations", href: "/organizations", icon: Building2 },
        { label: "Settings", href: "/settings", icon: Settings },
        ...(isDeveloper
          ? [{ label: "Developer", href: "/developer", icon: Code2 }]
          : []),
      ],
    },
    {
      title: "Support",
      items: [
        { label: "Help", href: "/help", icon: HelpCircle },
        { label: "Tickets", href: "/tickets", icon: Ticket },
      ],
    },
  ];

  return (
    <>
      {/* ─── Desktop Sidebar ─── */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-30 hidden h-screen flex-col border-r border-stone-200/60 bg-white/80 backdrop-blur-xl transition-[width] duration-300 ease-in-out motion-reduce:transition-none dark:border-zinc-800/60 dark:bg-zinc-950/80 md:flex",
          isExpanded ? "w-64" : "w-[72px]"
        )}
      >
        {/* ── Zone 1: Brand + Toggle ── */}
        <div
          className={cn(
            "flex h-14 items-center border-b border-stone-100 dark:border-zinc-800/50",
            isExpanded ? "justify-between px-4" : "justify-center"
          )}
        >
          {isExpanded ? (
            <>
              <div className="flex flex-1 items-center gap-3 overflow-hidden">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-sm shadow-indigo-500/25">
                  C
                </div>
                <motion.span
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                  className="truncate text-base font-bold tracking-tight text-stone-900 dark:text-white"
                >
                  Curator
                </motion.span>
              </div>
              <button
                type="button"
                onClick={toggle}
                aria-label="Collapse sidebar"
                aria-expanded={true}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </>
          ) : (
            <Tooltip label="Expand sidebar">
              <button
                type="button"
                onClick={toggle}
                aria-label="Expand sidebar"
                aria-expanded={false}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                <PanelLeftOpen className="h-5 w-5" />
              </button>
            </Tooltip>
          )}
        </div>

        {/* ── Zone 2: Navigation ── */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navSections.map((section, sectionIdx) => (
            <div key={section.title} className={cn(sectionIdx > 0 && "mt-6")}>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mb-2 overflow-hidden px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-zinc-500"
                  >
                    {section.title}
                  </motion.div>
                )}
              </AnimatePresence>
              {!isExpanded && sectionIdx > 0 && (
                <div className="mx-2 mb-3 border-t border-stone-100 dark:border-zinc-800/50" />
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <Tooltip
                      key={item.href}
                      label={item.label}
                      show={!isExpanded}
                    >
                      <Link
                        href={item.href}
                        aria-label={item.label}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex items-center rounded-xl text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                          isExpanded
                            ? "gap-3 px-3 py-2.5"
                            : "h-10 justify-center",
                          active
                            ? "text-indigo-600 dark:text-indigo-400"
                            : "text-stone-500 hover:bg-stone-50 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-white"
                        )}
                      >
                        {/* Sliding active background */}
                        {active && (
                          <motion.div
                            layoutId="sidebar-active"
                            className="absolute inset-0 rounded-xl bg-indigo-50 dark:bg-indigo-500/10"
                            transition={{
                              type: "spring",
                              bounce: 0.15,
                              duration: 0.5,
                            }}
                          />
                        )}
                        {/* Active left rail (expanded only) */}
                        {active && isExpanded && (
                          <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                        )}
                        {/* Icon with badge overlay for collapsed */}
                        <span className="relative z-10 inline-flex shrink-0">
                          <Icon className="h-5 w-5" />
                          {!isExpanded &&
                            item.badge != null &&
                            item.badge > 0 && (
                              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-bold leading-none text-white dark:bg-indigo-500">
                                {item.badge > 9 ? "9+" : item.badge}
                              </span>
                            )}
                        </span>
                        {/* Label (expanded only) */}
                        {isExpanded && (
                          <span className="relative z-10 flex-1 truncate">
                            {item.label}
                          </span>
                        )}
                        {/* Inline badge (expanded only) */}
                        {isExpanded &&
                          item.badge != null &&
                          item.badge > 0 && (
                            <span className="relative z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold leading-none text-white dark:bg-indigo-500">
                              {item.badge > 99 ? "99+" : item.badge}
                            </span>
                          )}
                      </Link>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Zone 3: Footer ── */}
        <div className="border-t border-stone-100 p-3 dark:border-zinc-800/50">
          {isExpanded ? (
            <div className="space-y-2">
              <div className="rounded-xl border border-stone-100 bg-stone-50/50 p-2 dark:border-zinc-800/50 dark:bg-zinc-900/50">
                <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-zinc-500">
                  Workspace
                </p>
                <OrgSwitcher dropdownDirection="up" />
              </div>
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <span className="text-xs text-stone-400 dark:text-zinc-500">
                    Theme
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Tooltip label="Switch workspace">
                <Link
                  href="/organizations"
                  aria-label="Switch organization"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                >
                  <Building2 className="h-4 w-4" />
                </Link>
              </Tooltip>
              <ThemeToggle />
              <Tooltip label="Sign out">
                <button
                  type="button"
                  onClick={handleSignOut}
                  aria-label="Sign out"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </Tooltip>
            </div>
          )}
        </div>
      </aside>

      {/* ─── Mobile Navigation ─── */}
      <div className="sticky top-0 z-30 flex flex-col border-b border-stone-200/60 bg-white/80 backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-950/80 md:hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white shadow-sm shadow-indigo-500/25">
              C
            </div>
            <OrgSwitcher dropdownDirection="down" />
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        <nav className="flex gap-0.5 overflow-x-auto border-t border-stone-100 px-3 py-1.5 dark:border-zinc-800/50">
          {navSections.flatMap((section) =>
            section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                    active
                      ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                      : "text-stone-500 hover:bg-stone-50 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-bold leading-none text-white dark:bg-indigo-500">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </Link>
              );
            })
          )}
        </nav>
      </div>
    </>
  );
}
