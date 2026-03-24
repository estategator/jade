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
  getRevenueByMonth,
  getRecentSales,
  getSalesRevenue,
} from "./actions";
import {
  DashboardRevenueChart,
  DashboardCategoryChart,
} from "./_components/dashboard-charts";
import { DashboardErrorToast } from "./_components/dashboard-error-toast";

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

  const [statsRes, catRes, revRes, salesRes, salesRevRes] = await Promise.all([
    getDashboardStats(user.id, activeOrgId),
    getCategoryBreakdown(user.id, activeOrgId),
    getRevenueByMonth(user.id, activeOrgId),
    getRecentSales(user.id, activeOrgId),
    getSalesRevenue(user.id, activeOrgId),
  ]);

  // ── Aggregate errors ────────────────────────────────────
  const errors: string[] = [
    statsRes.error,
    catRes.error,
    revRes.error,
    salesRes.error,
    salesRevRes.error,
  ].filter((e): e is string => !!e);

  const statsLoaded = !statsRes.error;
  const stats = statsRes.data;
  const categories = catRes.data || [];
  const revenueData = revRes.data || [];
  const recentSales = salesRes.data || [];
  const salesRevenue = salesRevRes.data || { total: 0, count: 0 };

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
      label: "Total Value",
      value: stats?.totalRevenue ?? 0,
      fmt: (v: number) =>
        `$${(stats?.totalRevenue ?? 0).toLocaleString("en-US", {
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

      {/* Charts */}
      {hasData && (
        <div className="mb-8 grid gap-4 lg:grid-cols-2 animate-fade-in-up [animation-delay:200ms] fill-mode-both">
          {/* Revenue over time */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center gap-2">
              <PiCurrencyDollarDuotone className="h-4 w-4 text-[var(--color-brand-primary)]" />
              <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
                Revenue (last 6 months)
              </h3>
            </div>
            <DashboardRevenueChart data={revenueData} />
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

      {/* Recent Sales */}
      {recentSales.length > 0 && (
        <div className="mb-8 animate-fade-in-up [animation-delay:250ms] fill-mode-both">
          <div className="mb-4 flex items-center gap-2">
            <PiReceiptDuotone className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            <h2 className="text-lg font-bold text-stone-900 dark:text-white">
              Recent Sales
            </h2>
          </div>
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="hidden border-b border-stone-200 px-5 py-3 sm:grid sm:grid-cols-12 sm:gap-4 dark:border-zinc-800">
              <span className="col-span-4 text-xs font-medium uppercase tracking-wider text-stone-500">
                Item
              </span>
              <span className="col-span-3 text-xs font-medium uppercase tracking-wider text-stone-500">
                Buyer
              </span>
              <span className="col-span-2 text-xs font-medium uppercase tracking-wider text-stone-500">
                Amount
              </span>
              <span className="col-span-3 text-xs font-medium uppercase tracking-wider text-stone-500 text-right">
                Date
              </span>
            </div>
            {recentSales.map((sale) => (
              <div
                key={sale.id}
                className="grid grid-cols-1 gap-2 border-b border-stone-100 px-5 py-3.5 last:border-b-0 sm:grid-cols-12 sm:items-center sm:gap-4 dark:border-zinc-800/50"
              >
                <p className="col-span-4 text-sm font-medium text-stone-900 dark:text-white">
                  {sale.inventory_items?.name ?? "Unknown item"}
                </p>
                <p className="col-span-3 truncate text-sm text-stone-600 dark:text-zinc-400">
                  {sale.buyer_email ?? "—"}
                </p>
                <p className="col-span-2 text-sm font-medium text-stone-900 dark:text-white">
                  ${sale.amount.toFixed(2)}
                </p>
                <p className="col-span-3 text-right text-sm text-stone-500 dark:text-zinc-500">
                  {new Date(sale.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="animate-fade-in-up [animation-delay:300ms] fill-mode-both">
        <h2 className="mb-4 text-lg font-bold text-stone-900 dark:text-white">
          Quick actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className="group rounded-2xl border border-stone-200 bg-white p-5 text-left transition-all hover:border-[var(--color-brand-primary)]/20 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-[var(--color-brand-primary)]/40"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-brand-subtle)] text-[var(--color-brand-primary)]">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-stone-900 dark:text-white">
                  {action.label}
                </p>
                <p className="mt-1 text-xs text-stone-500 dark:text-zinc-500">
                  {action.description}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

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

