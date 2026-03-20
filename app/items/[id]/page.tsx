import { notFound } from "next/navigation";
import Image from "next/image";
import {
  Tag,
  Layers,
  Sparkles,
  Clock,
  Store,
  Building2,
  ShieldCheck,
  TrendingUp,
  CircleDollarSign,
} from "lucide-react";
import { getPublicInventoryItem } from "@/app/inventory/actions";
import type { AIAnalysisResult } from "@/app/inventory/actions";
import { ItemBuyButton } from "@/app/items/[id]/buy-button";

export const dynamic = "force-dynamic";

const statusConfig: Record<
  string,
  { label: string; className: string; dot: string }
> = {
  available: {
    label: "Available",
    className:
      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-400/20",
    dot: "bg-emerald-500",
  },
  sold: {
    label: "Sold",
    className:
      "bg-stone-100 text-stone-500 ring-1 ring-stone-300 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-600",
    dot: "bg-stone-400 dark:bg-zinc-500",
  },
  reserved: {
    label: "Reserved",
    className:
      "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20 dark:bg-indigo-900/20 dark:text-indigo-400 dark:ring-indigo-400/20",
    dot: "bg-indigo-500",
  },
};

const conditionRank: Record<string, number> = {
  Excellent: 4,
  Good: 3,
  Fair: 2,
  Poor: 1,
};

function ConditionMeter({ condition }: { condition: string }) {
  const level = conditionRank[condition] ?? 2;
  const colors = [
    "bg-red-400 dark:bg-red-500",
    "bg-amber-400 dark:bg-amber-500",
    "bg-emerald-400 dark:bg-emerald-500",
    "bg-emerald-500 dark:bg-emerald-400",
  ];
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-2 w-6 rounded-full ${
              i <= level
                ? colors[level - 1]
                : "bg-stone-200 dark:bg-zinc-700"
            }`}
          />
        ))}
      </div>
      <span className="text-sm font-medium text-stone-700 dark:text-zinc-300">
        {condition}
      </span>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? "Just listed" : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default async function PublicItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getPublicInventoryItem(id);

  if (!result.data) {
    notFound();
  }

  const item = result.data;
  const heroImage = item.original_image_url || item.medium_image_url;
  const fallbackImage = item.medium_image_url || item.thumbnail_url;
  const displayImage = heroImage || fallbackImage;
  const status = statusConfig[item.status] ?? statusConfig.available;
  const rawProject = item.project as unknown as {
    name: string;
    organizations: { name: string } | null;
  } | null;
  const project = rawProject;
  const insights = item.ai_insights as AIAnalysisResult | null;
  const listedAgo = item.created_at ? timeAgo(item.created_at) : null;

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          {/* ── Left column: Image ── */}
          <div className="lg:col-span-3">
            <div className="sticky top-8 space-y-4">
              {/* Hero image */}
              <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                {displayImage ? (
                  <div className="relative aspect-[4/3] w-full bg-stone-100 dark:bg-zinc-800">
                    <Image
                      src={displayImage}
                      alt={item.name}
                      fill
                      className="object-contain"
                      sizes="(max-width: 1024px) 100vw, 60vw"
                      priority
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[4/3] w-full items-center justify-center bg-stone-100 dark:bg-zinc-800">
                    <Layers className="h-16 w-16 text-stone-300 dark:text-zinc-600" />
                  </div>
                )}
              </div>

              {/* AI Insights card — desktop only */}
              {insights && (
                <div className="hidden lg:block rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-500" />
                    <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
                      AI Price Analysis
                    </h3>
                  </div>
                  {insights.pricePerCondition && (
                    <div className="grid grid-cols-4 gap-2">
                      {(
                        [
                          ["Excellent", insights.pricePerCondition.excellent],
                          ["Good", insights.pricePerCondition.good],
                          ["Fair", insights.pricePerCondition.fair],
                          ["Poor", insights.pricePerCondition.poor],
                        ] as const
                      ).map(([label, val]) => (
                        <div
                          key={label}
                          className={`rounded-xl px-3 py-2.5 text-center ${
                            item.condition === label
                              ? "bg-indigo-50 ring-2 ring-indigo-500/30 dark:bg-indigo-900/30 dark:ring-indigo-400/30"
                              : "bg-stone-50 dark:bg-zinc-800"
                          }`}
                        >
                          <p className="text-[10px] font-medium uppercase tracking-wider text-stone-500 dark:text-zinc-500">
                            {label}
                          </p>
                          <p
                            className={`mt-0.5 text-sm font-bold ${
                              item.condition === label
                                ? "text-indigo-600 dark:text-indigo-400"
                                : "text-stone-700 dark:text-zinc-300"
                            }`}
                          >
                            ${val.toFixed(0)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  {item.condition &&
                    insights.pricePerCondition &&
                    item.price <=
                      (insights.pricePerCondition as Record<string, number>)[
                        item.condition.toLowerCase()
                      ] && (
                      <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                        <TrendingUp className="h-3.5 w-3.5" />
                        Priced at or below market value for this condition
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>

          {/* ── Right column: Details + CTA ── */}
          <div className="lg:col-span-2 space-y-5">
            {/* Header card */}
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              {/* Status + freshness row */}
              <div className="mb-4 flex items-center justify-between">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${status.dot}`}
                  />
                  {status.label}
                </span>
                {listedAgo && (
                  <span className="inline-flex items-center gap-1 text-xs text-stone-500 dark:text-zinc-500">
                    <Clock className="h-3 w-3" />
                    {listedAgo}
                  </span>
                )}
              </div>

              {/* Name */}
              <h1 className="text-2xl font-bold leading-tight text-stone-900 dark:text-white sm:text-3xl">
                {item.name}
              </h1>

              {/* Price */}
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-stone-900 dark:text-white">
                  ${item.price.toFixed(2)}
                </span>
                {insights?.pricePerCondition &&
                  item.condition &&
                  item.price <
                    (insights.pricePerCondition as Record<string, number>)[
                      item.condition.toLowerCase()
                    ] && (
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      Great deal
                    </span>
                  )}
              </div>

              {/* Condition meter */}
              <div className="mt-4">
                <ConditionMeter condition={item.condition} />
              </div>

              {/* CTA */}
              <div className="mt-6">
                {item.status === "available" ? (
                  <ItemBuyButton itemId={item.id} price={item.price} />
                ) : (
                  <div className="rounded-xl bg-stone-100 px-4 py-3.5 text-center dark:bg-zinc-800">
                    <p className="text-sm font-semibold text-stone-500 dark:text-zinc-400">
                      {item.status === "sold"
                        ? "This item has been sold"
                        : "This item is currently reserved"}
                    </p>
                  </div>
                )}
              </div>

              {/* Trust signals */}
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-stone-100 pt-4 dark:border-zinc-800">
                <span className="inline-flex items-center gap-1.5 text-xs text-stone-500 dark:text-zinc-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  Secure checkout
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-stone-500 dark:text-zinc-500">
                  <CircleDollarSign className="h-3.5 w-3.5 text-indigo-500" />
                  Powered by Stripe
                </span>
              </div>
            </div>

            {/* Description card */}
            {item.description && (
              <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-500">
                  Description
                </h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-stone-700 dark:text-zinc-300">
                  {item.description}
                </p>
              </div>
            )}

            {/* Details card */}
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-500">
                Item Details
              </h2>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="inline-flex items-center gap-2 text-stone-500 dark:text-zinc-500">
                    <Tag className="h-3.5 w-3.5" />
                    Category
                  </dt>
                  <dd className="font-medium text-stone-900 dark:text-white">
                    {item.category}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="inline-flex items-center gap-2 text-stone-500 dark:text-zinc-500">
                    <Sparkles className="h-3.5 w-3.5" />
                    Condition
                  </dt>
                  <dd className="font-medium text-stone-900 dark:text-white">
                    {item.condition}
                  </dd>
                </div>
                {project && (
                  <div className="flex items-center justify-between">
                    <dt className="inline-flex items-center gap-2 text-stone-500 dark:text-zinc-500">
                      <Store className="h-3.5 w-3.5" />
                      Sale
                    </dt>
                    <dd className="font-medium text-stone-900 dark:text-white">
                      {project.name}
                    </dd>
                  </div>
                )}
                {project?.organizations?.name && (
                  <div className="flex items-center justify-between">
                    <dt className="inline-flex items-center gap-2 text-stone-500 dark:text-zinc-500">
                      <Building2 className="h-3.5 w-3.5" />
                      Seller
                    </dt>
                    <dd className="font-medium text-stone-900 dark:text-white">
                      {project.organizations.name}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* AI Insights — mobile (shown below details on small screens) */}
            {insights && (
              <div className="lg:hidden rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
                    AI Price Analysis
                  </h3>
                </div>
                {insights.pricePerCondition && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(
                      [
                        ["Excellent", insights.pricePerCondition.excellent],
                        ["Good", insights.pricePerCondition.good],
                        ["Fair", insights.pricePerCondition.fair],
                        ["Poor", insights.pricePerCondition.poor],
                      ] as const
                    ).map(([label, val]) => (
                      <div
                        key={label}
                        className={`rounded-xl px-3 py-2.5 text-center ${
                          item.condition === label
                            ? "bg-indigo-50 ring-2 ring-indigo-500/30 dark:bg-indigo-900/30 dark:ring-indigo-400/30"
                            : "bg-stone-50 dark:bg-zinc-800"
                        }`}
                      >
                        <p className="text-[10px] font-medium uppercase tracking-wider text-stone-500 dark:text-zinc-500">
                          {label}
                        </p>
                        <p
                          className={`mt-0.5 text-sm font-bold ${
                            item.condition === label
                              ? "text-indigo-600 dark:text-indigo-400"
                              : "text-stone-700 dark:text-zinc-300"
                          }`}
                        >
                          ${val.toFixed(0)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {item.condition &&
                  insights.pricePerCondition &&
                  item.price <=
                    (insights.pricePerCondition as Record<string, number>)[
                      item.condition.toLowerCase()
                    ] && (
                    <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Priced at or below market value for this condition
                    </div>
                  )}
              </div>
            )}

            {/* Sticky mobile CTA — visible when scrolled past main button */}
            {item.status === "available" && (
              <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur-sm lg:hidden dark:border-zinc-800 dark:bg-zinc-900/95">
                <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-stone-500 dark:text-zinc-500">
                      {item.name}
                    </p>
                    <p className="text-lg font-extrabold text-stone-900 dark:text-white">
                      ${item.price.toFixed(2)}
                    </p>
                  </div>
                  <ItemBuyButton itemId={item.id} price={item.price} compact />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
