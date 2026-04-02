import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import {
  PiScanDuotone,
  PiPackageDuotone,
  PiCurrencyDollarDuotone,
  PiTrendUpDuotone,
  PiChartBarDuotone,
  PiBuildingsDuotone,
  PiReceiptDuotone,
  PiHourglassDuotone,
  PiUploadDuotone,
} from "react-icons/pi";

import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveActiveOrgId } from "@/lib/rbac";
import { PageHeader } from "@/app/components/page-header";
import { UpgradeIntentHandler } from "@/app/dashboard/upgrade-intent-handler";
import {
  getDashboardStats,
  getCategoryBreakdown,
  getRevenueByRange,
  getRecentSales,
  getSalesRevenue,
  getInventoryHealth,
} from "./actions";
import { DashboardCategoryChart } from "./_components/dashboard-charts";
import { RevenueChartWithPeriod } from "./_components/revenue-chart-with-period";
import { RecentSalesTable } from "./recent-sales-table";
import { DashboardErrorToast } from "./_components/dashboard-error-toast";

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDays(value: number | null, emptyLabel: string) {
  if (value === null) return emptyLabel;
  const rounded = Math.round(value);
  return `${rounded}d`;
}

function healthBucketInventoryHref(bucketLabel: string) {
  if (bucketLabel === "0-30d") return "/inventory?age=0-30";
  if (bucketLabel === "31-60d") return "/inventory?age=31-60";
  if (bucketLabel === "61-90d") return "/inventory?age=61-90";
  return "/inventory?age=90-plus";
}

function bucketToneClasses(tone: "fresh" | "watch" | "attention" | "critical") {
  switch (tone) {
    case "fresh":
      return {
        bar: "bg-emerald-500 dark:bg-emerald-400",
        badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
      };
    case "watch":
      return {
        bar: "bg-[var(--color-brand-primary)]",
        badge: "bg-[var(--color-brand-subtle)] text-[var(--color-brand-primary)]",
      };
    case "attention":
      return {
        bar: "bg-red-400 dark:bg-red-400",
        badge: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
      };
    case "critical":
    default:
      return {
        bar: "bg-red-600 dark:bg-red-500",
        badge: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200",
      };
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // ── Subscription debug logging (dev only) ──────────────
  if (process.env.NODE_ENV === 'development' && params.subscription === 'success') {
    console.log('[dashboard] ?subscription=success — checking subscription state for user:', user.id);

    // Find all orgs the user belongs to
    const { data: memberships, error: memErr } = await supabaseAdmin
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id);
    console.log('[dashboard] User org memberships:', memberships, 'error:', memErr);

    if (memberships && memberships.length > 0) {
      const orgIds = memberships.map((m) => m.org_id);
      // Check subscriptions table
      const { data: subs, error: subErr } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .in('org_id', orgIds);
      console.log('[dashboard] Subscriptions rows for user orgs:', JSON.stringify(subs, null, 2), 'error:', subErr);

      // Also check legacy org columns for comparison
      const { data: orgs, error: orgErr } = await supabaseAdmin
        .from('organizations')
        .select('id, name, subscription_tier, subscription_status, stripe_subscription_id, stripe_customer_id')
        .in('id', orgIds);
      console.log('[dashboard] Organizations (legacy columns):', JSON.stringify(orgs, null, 2), 'error:', orgErr);
    }
  }

  const activeOrgId = await resolveActiveOrgId(user.id);

  const [statsRes, catRes, revRes, salesRes, salesRevRes, healthRes] = await Promise.all([
    getDashboardStats(user.id, activeOrgId),
    getCategoryBreakdown(user.id, activeOrgId),
    getRevenueByRange(user.id, activeOrgId),
    getRecentSales(user.id, activeOrgId),
    getSalesRevenue(user.id, activeOrgId),
    getInventoryHealth(user.id, activeOrgId),
  ]);

  // ── Aggregate errors ────────────────────────────────────
  const errors: string[] = [
    statsRes.error,
    catRes.error,
    revRes.error,
    salesRes.error,
    salesRevRes.error,
    healthRes.error,
  ].filter((e): e is string => !!e);

  const statsLoaded = !statsRes.error;
  const stats = statsRes.data;
  const categories = catRes.data || [];
  const revenueData = revRes.data || [];
  const recentSales = salesRes.data || [];
  const salesRevenue = salesRevRes.data || { total: 0, count: 0 };
  const inventoryHealth = healthRes.data || {
    sellThroughRate: 0,
    reservedRate: 0,
    averageDaysToSell: null,
    averageUnsoldAge: null,
    staleItemCount: 0,
    buckets: [
      { label: "0-30d", count: 0, tone: "fresh" as const },
      { label: "31-60d", count: 0, tone: "watch" as const },
      { label: "61-90d", count: 0, tone: "attention" as const },
      { label: "90+d", count: 0, tone: "critical" as const },
    ],
  };
  const unsoldTotal = inventoryHealth.buckets.reduce((sum, bucket) => sum + bucket.count, 0);

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "there";

  const statCards = [
    {
      label: "Total Items",
      value: stats?.totalItems ?? 0,
      fmt: (v: number) => String(v),
      icon: PiPackageDuotone,
      color: "text-[var(--color-brand-primary)]",
      bg: "bg-[var(--color-brand-subtle)]",
    },
    {
      label: "Available",
      value: stats?.availableItems ?? 0,
      fmt: (v: number) => String(v),
      icon: PiScanDuotone,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
    },
    {
      label: "Sold",
      value: stats?.soldItems ?? 0,
      fmt: (v: number) => String(v),
      icon: PiTrendUpDuotone,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-900/20",
    },
    {
      label: "Inventory Value",
      value: stats?.totalInventoryValue ?? 0,
      fmt: (v: number) =>
        `$${(stats?.totalInventoryValue ?? 0).toLocaleString("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })}`,
      icon: PiCurrencyDollarDuotone,
      color: "text-[var(--color-brand-primary)]",
      bg: "bg-[var(--color-brand-subtle)]",
    },
    {
      label: "Sales Revenue",
      value: salesRevenue.total,
      fmt: (v: number) =>
        `$${v.toLocaleString("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })}`,
      icon: PiReceiptDuotone,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-900/20",
    },
  ];

  const quickActions = [
    {
      label: "Scan an item",
      description: "Use AI to price and catalogue",
      icon: PiScanDuotone,
      href: "#",
    },
    {
      label: "View inventory",
      description: "Browse your item catalogue",
      icon: PiPackageDuotone,
      href: "/inventory",
    },
    {
      label: "Add item",
      description: "Add a new inventory item",
      icon: PiTrendUpDuotone,
      href: "/inventory/add",
    },
    {
      label: "Bulk add items",
      description: "Upload multiple items at once using AI",
      icon: PiUploadDuotone,
      href: "/inventory/bulk",
    },
    {
      label: "Organizations",
      description: "Manage your teams and orgs",
      icon: PiBuildingsDuotone,
      href: "/organizations",
    },
  ];

  const hasData = statsLoaded && (stats?.totalItems ?? 0) > 0;

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <DashboardErrorToast errors={errors} />
      <PageHeader
        title={`Welcome back, ${displayName}`}
        description="Track inventory, sales, and revenue across your estate sales at a glance."
      />

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5 animate-fade-in-up [animation-delay:100ms] fill-mode-both">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}
                >
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold text-stone-900 dark:text-white">
                  {stat.fmt(stat.value)}
                </p>
                <p className="text-sm text-stone-500 dark:text-zinc-500">
                  {stat.label}
                </p>
              </div>
            );
          })}
      </div>

      {/* Quick actions */}
      <div className="mb-6 animate-fade-in-up [animation-delay:200ms] fill-mode-both">
        <h2 className="mb-2 text-sm font-semibold text-stone-700 dark:text-zinc-300">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className="group flex items-center gap-2.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-left transition-all hover:border-[var(--color-brand-primary)]/20 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-[var(--color-brand-primary)]/40"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--color-brand-subtle)] text-[var(--color-brand-primary)]">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-stone-900 dark:text-white">
                    {action.label}
                  </p>
                  <p className="truncate text-[11px] leading-tight text-stone-500 dark:text-zinc-500">
                    {action.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Charts */}
      {hasData && (
        <div className="mb-4 grid gap-4 lg:grid-cols-2 animate-fade-in-up [animation-delay:300ms] fill-mode-both">
          {/* Revenue over time */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center gap-2">
              <PiCurrencyDollarDuotone className="h-4 w-4 text-[var(--color-brand-primary)]" />
              <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
                Revenue
              </h3>
            </div>
            <RevenueChartWithPeriod
              initialData={revenueData}
              userId={user.id}
              orgId={activeOrgId ?? null}
            />
          </div>

          {/* Inventory by category */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center gap-2">
              <PiChartBarDuotone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
                Inventory by category
              </h3>
            </div>
            <DashboardCategoryChart data={categories} />
          </div>
        </div>
      )}

      {hasData && (
        <div className="mb-8 animate-fade-in-up [animation-delay:340ms] fill-mode-both">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <PiHourglassDuotone className="h-4 w-4 text-[var(--color-brand-primary)]" />
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
                    Inventory health
                  </h3>
                </div>
                <p className="text-sm text-stone-600 dark:text-zinc-400">
                  Track sell-through, stalled inventory, and how long items sit before they move.
                </p>
              </div>
              <Link
                href="/inventory?age=61-90"
                className="inline-flex items-center gap-2 self-start rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <span className="h-2 w-2 rounded-full bg-red-500" />
                {inventoryHealth.staleItemCount} items need attention
              </Link>
            </div>

            <div className="mb-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500 dark:text-zinc-500">
                  Sell-through
                </p>
                <p className="mt-2 text-2xl font-bold text-stone-900 dark:text-white">
                  {formatPercent(inventoryHealth.sellThroughRate)}
                </p>
                <p className="mt-1 text-sm text-stone-600 dark:text-zinc-400">
                  Portion of inventory already sold.
                </p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500 dark:text-zinc-500">
                  Avg time to sell
                </p>
                <p className="mt-2 text-2xl font-bold text-stone-900 dark:text-white">
                  {formatDays(inventoryHealth.averageDaysToSell, "No sales")}
                </p>
                <p className="mt-1 text-sm text-stone-600 dark:text-zinc-400">
                  Measured from item creation to recorded sale date.
                </p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500 dark:text-zinc-500">
                  Unsold inventory age
                </p>
                <p className="mt-2 text-2xl font-bold text-stone-900 dark:text-white">
                  {formatDays(inventoryHealth.averageUnsoldAge, "No unsold items")}
                </p>
                <p className="mt-1 text-sm text-stone-600 dark:text-zinc-400">
                  Reserved share: {formatPercent(inventoryHealth.reservedRate)} of all items.
                </p>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)] lg:items-start">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-stone-900 dark:text-white">
                    Aging mix for unsold inventory
                  </p>
                  <p className="text-xs text-stone-500 dark:text-zinc-500">
                    {unsoldTotal} active {unsoldTotal === 1 ? "item" : "items"}
                  </p>
                </div>
                <div className="flex h-3 overflow-hidden rounded-full bg-stone-100 dark:bg-zinc-800">
                  {inventoryHealth.buckets.map((bucket) => {
                    const width = unsoldTotal > 0 ? `${(bucket.count / unsoldTotal) * 100}%` : "0%";
                    const tone = bucketToneClasses(bucket.tone);
                    return (
                      <div
                        key={bucket.label}
                        className={`${tone.bar} transition-all`}
                        style={{ width }}
                        aria-label={`${bucket.label}: ${bucket.count} items`}
                      />
                    );
                  })}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {inventoryHealth.buckets.map((bucket) => {
                    const tone = bucketToneClasses(bucket.tone);
                    const percentage = unsoldTotal > 0 ? Math.round((bucket.count / unsoldTotal) * 100) : 0;
                    return (
                      <div
                        key={bucket.label}
                        className="rounded-xl border border-stone-200 p-3 dark:border-zinc-800"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${tone.badge}`}>
                            {bucket.label}
                          </span>
                          <span className="text-xs text-stone-500 dark:text-zinc-500">
                            {percentage}%
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-stone-900 dark:text-white">
                          {bucket.count}
                        </p>
                        <p className="mt-1 text-sm text-stone-600 dark:text-zinc-400">
                          {bucket.label === "90+d" ? "Long-stalled items." : bucket.label === "61-90d" ? "Starting to age out." : bucket.label === "31-60d" ? "Worth reviewing soon." : "Freshly listed inventory."}
                        </p>
                        <Link
                          href={healthBucketInventoryHref(bucket.label)}
                          className="mt-2 inline-flex text-xs font-medium text-[var(--color-brand-primary)] hover:opacity-80"
                        >
                          View items
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                <p className="text-sm font-semibold text-stone-900 dark:text-white">
                  What to watch
                </p>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500 dark:text-zinc-500">
                      Aging pressure
                    </p>
                    <p className="mt-1 text-sm text-stone-700 dark:text-zinc-300">
                      {inventoryHealth.staleItemCount > 0
                        ? `${inventoryHealth.staleItemCount} items have been unsold for more than 60 days.`
                        : "No inventory has crossed the 60-day threshold yet."}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500 dark:text-zinc-500">
                      Inventory flow
                    </p>
                    <p className="mt-1 text-sm text-stone-700 dark:text-zinc-300">
                      {inventoryHealth.sellThroughRate >= 0.4
                        ? "Sell-through is healthy relative to your current inventory mix."
                        : "Sell-through is still low, so repricing or promoting older items may help."}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500 dark:text-zinc-500">
                      Reserved backlog
                    </p>
                    <p className="mt-1 text-sm text-stone-700 dark:text-zinc-300">
                      {inventoryHealth.reservedRate >= 0.2
                        ? "A noticeable share of items are reserved. Follow-through and checkout completion are worth checking."
                        : "Reserved inventory is under control and not dominating the active catalog."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Sales */}
      {recentSales.length > 0 && (
        <div className="mb-8 animate-fade-in-up [animation-delay:250ms] fill-mode-both">
          <div className="mb-4 flex items-center gap-2">
            <PiReceiptDuotone className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            <h2 className="text-lg font-bold text-stone-900 dark:text-white">
              Recent Sales
            </h2>
          </div>
          <RecentSalesTable sales={recentSales} />
        </div>
      )}



      {/* Empty state — only when data loaded successfully and actual counts are zero */}
      {!hasData && statsLoaded && (
        <div className="mt-10 rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900 animate-fade-in-up [animation-delay:400ms] fill-mode-both">
          <PiScanDuotone className="mx-auto mb-4 h-10 w-10 text-stone-400 dark:text-zinc-600" />
          <h3 className="text-lg font-bold text-stone-900 dark:text-white">
            No items yet
          </h3>
          <p className="mt-2 text-sm text-stone-600 dark:text-zinc-400">
            Start by adding your first item to build your inventory and see
            analytics here.
          </p>
        </div>
      )}

      {/* Upgrade intent consumer */}
      <UpgradeIntentHandler />
    </div>
  );
}

