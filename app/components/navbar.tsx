"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Package, Building2, BarChart3, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSettings } from "@/app/components/settings-provider";
import { OrgSwitcher } from "@/app/components/org-switcher";
import { ThemeToggle } from "@/app/components/theme-toggle";

type NavbarProps = {
  authenticated?: boolean;
  onSignOut?: () => void;
  launchBadge?: string;
};

export function Navbar({ authenticated = false, onSignOut, launchBadge }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { settings } = useSettings();

  const handleSignOut = async () => {
    if (onSignOut) {
      onSignOut();
    } else {
      await supabase.auth.signOut();
      router.replace("/login");
    }
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const navItems = [
    { label: "Dashboard", mobileLabel: "Dash", href: "/dashboard", icon: BarChart3 },
    { label: "Inventory", mobileLabel: "Inv", href: "/inventory", icon: Package },
    { label: "Organizations", mobileLabel: "Orgs", href: "/organizations", icon: Building2 },
  ];

  return (
    <nav className="sticky top-0 left-0 right-0 z-40 border-b border-stone-200/50 bg-stone-50/90 backdrop-blur-md dark:border-zinc-800/50 dark:bg-zinc-950/90">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between sm:h-16">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href={authenticated ? "/dashboard" : "/"} className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">
              {settings.logoUrl ? (
                <Image
                  src={settings.logoUrl}
                  alt="Logo"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-lg object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900 font-bold text-white dark:bg-white dark:text-stone-900">
                  C
                </div>
              )}
              <span className="hidden text-xl font-bold tracking-tight text-stone-900 sm:inline dark:text-white font-display">
                Curator
              </span>
            </Link>

            {authenticated && <OrgSwitcher />}
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1.5">
            {authenticated ? (
              <>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-label={item.label}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] sm:gap-2 sm:px-3 sm:py-2 sm:text-sm ${
                        active
                          ? "bg-stone-200/70 text-stone-900 dark:bg-zinc-800 dark:text-white"
                          : "text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="sm:hidden">{item.mobileLabel}</span>
                      <span className="hidden sm:inline">{item.label}</span>
                    </Link>
                  );
                })}

                <ThemeToggle />

              <div className="ml-1 border-l border-stone-200 pl-1 dark:border-zinc-800 sm:ml-3 sm:pl-3">
                <button
                  type="button"
                  onClick={handleSignOut}
                  aria-label="Sign out"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs font-medium text-stone-600 transition-all hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-white sm:gap-2 sm:px-3 sm:text-sm"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
              </>
            ) : (
              <>
                {launchBadge && (
                  <span className="text-sm font-medium text-stone-500 font-body">{launchBadge}</span>
                )}
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] font-body"
                >
                  Pricing
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium rounded-xl text-white bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-focus-ring)] transition-all shadow-sm font-body"
                >
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
