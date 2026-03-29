import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  PiTagDuotone,
  PiStackDuotone,
  PiClockDuotone,
  PiStorefrontDuotone,
  PiBuildingsDuotone,
  PiShieldCheckDuotone,
  PiTrendUpDuotone,
  PiCurrencyDollarDuotone,
  PiCaretLeftDuotone,
  PiMedalDuotone,
  PiPackageDuotone,
} from "react-icons/pi";
import { getPublicInventoryItem } from "@/app/inventory/actions";
import type { AIAnalysisResult } from "@/app/inventory/actions";
import { ItemBuyButton } from "@/app/items/[id]/buy-button";
import { SITE_URL, SITE_NAME, productJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await getPublicInventoryItem(id);
  if (!result.data) return { title: 'Item Not Found' };

  const item = result.data;
  const title = item.name;
  const description = item.description
    ? item.description.slice(0, 160)
    : `${item.name} — ${item.category} for $${item.price.toFixed(2)}`;
  const url = `${SITE_URL}/items/${id}`;
  const image = item.medium_image_url || item.thumbnail_url;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

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
      "bg-[var(--color-brand-subtle)] text-[var(--color-brand-primary)] ring-1 ring-[var(--color-brand-primary)]/20",
    dot: "bg-[var(--color-brand-primary)]",
  },
};

const conditionRank: Record<string, number> = {
  Excellent: 4,
  Good: 3,
  Fair: 2,
  Poor: 1,
};

const conditionLabel: Record<string, string> = {
  Excellent: "Pristine",
  Good: "Great shape",
  Fair: "Some wear",
  Poor: "Well-loved",
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
    <div className="flex items-center gap-3">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1.5 w-5 rounded-full transition-colors ${
              i <= level
                ? colors[level - 1]
                : "bg-stone-200 dark:bg-zinc-700"
            }`}
          />
        ))}
      </div>
      <span className="text-sm font-medium text-stone-600 dark:text-zinc-400">
        {conditionLabel[condition] ?? condition}
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

  const marketPrice =
    insights?.pricePerCondition && item.condition
      ? (insights.pricePerCondition as Record<string, number>)[
          item.condition.toLowerCase()
        ]
      : null;
  const isBelowMarket = marketPrice != null && item.price <= marketPrice;

  const itemUrl = `${SITE_URL}/items/${id}`;
  const sellerName = project?.organizations?.name ?? undefined;

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            productJsonLd({
              name: item.name,
              description: item.description || `${item.name} — ${item.category}`,
              image: displayImage ?? undefined,
              price: item.price,
              url: itemUrl,
              condition: item.condition,
              availability: item.status === 'available' ? 'InStock' : 'SoldOut',
              seller: sellerName,
            }),
          ),
        }}
      />
      {/* ── Top bar ── */}
      <div className="border-b border-stone-100 bg-white/80 backdrop-blur-sm dark:border-zinc-800/50 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-stone-500 transition-colors hover:text-stone-900 dark:text-zinc-500 dark:hover:text-white"
          >
            <PiCaretLeftDuotone className="h-4 w-4" aria-hidden="true" />
            Back
          </Link>
          <span className="text-stone-300 dark:text-zinc-700">/</span>
          <span className="truncate text-sm text-stone-400 dark:text-zinc-600">
            {item.category}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
          {/* ── Left column: Image ── */}
          <div className="lg:col-span-7">
            <div className="sticky top-6 space-y-4">
              {/* Hero image */}
              <div className="overflow-hidden rounded-2xl border border-stone-100 bg-stone-50 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                {displayImage ? (
                  <div className="relative aspect-square w-full sm:aspect-[4/3] bg-stone-50 dark:bg-zinc-900">
                    <Image
                      src={displayImage}
                      alt={item.name}
                      fill
                      className="object-contain p-4"
                      sizes="(max-width: 1024px) 100vw, 58vw"
                      priority
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex aspect-square w-full sm:aspect-[4/3] items-center justify-center bg-stone-50 dark:bg-zinc-900">
                    <PiStackDuotone className="h-20 w-20 text-stone-200 dark:text-zinc-700" aria-hidden="true" />
                  </div>
                )}
              </div>

              {/* Market Valuation — desktop only */}
              {insights?.pricePerCondition && (
                <div className="hidden lg:block rounded-2xl border border-stone-100 bg-stone-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <div className="mb-4 flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/30">
                      <PiMedalDuotone className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
                        Market Valuation
                      </h3>
                      <p className="text-xs text-stone-500 dark:text-zinc-500">
                        Estimated value by condition
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {(
                      [
                        ["Excellent", insights.pricePerCondition.excellent],
                        ["Good", insights.pricePerCondition.good],
                        ["Fair", insights.pricePerCondition.fair],
                        ["Poor", insights.pricePerCondition.poor],
                      ] as const
                    ).map(([label, val]) => {
                      const isActive = item.condition === label;
                      return (
                        <div
                          key={label}
                          className={`relative rounded-xl px-3 py-3 text-center transition-all ${
                            isActive
                              ? "bg-white ring-2 ring-indigo-500/30 shadow-sm dark:bg-zinc-800 dark:ring-indigo-400/30"
                              : "bg-white/60 dark:bg-zinc-800/60"
                          }`}
                        >
                          {isActive && (
                            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white dark:bg-indigo-500">
                              This item
                            </div>
                          )}
                          <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 dark:text-zinc-500">
                            {label}
                          </p>
                          <p
                            className={`mt-1 text-base font-bold tabular-nums ${
                              isActive
                                ? "text-indigo-600 dark:text-indigo-400"
                                : "text-stone-600 dark:text-zinc-400"
                            }`}
                          >
                            ${val.toFixed(0)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  {isBelowMarket && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50/80 px-3 py-2.5 dark:bg-emerald-900/20">
                      <PiTrendUpDuotone className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        Priced at or below market value
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Right column: Details + CTA ── */}
          <div className="lg:col-span-5 space-y-5">
            {/* Header section */}
            <div>
              {/* Status + freshness row */}
              <div className="mb-3 flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${status.dot}`}
                  />
                  {status.label}
                </span>
                {listedAgo && (
                  <span className="inline-flex items-center gap-1 text-xs text-stone-400 dark:text-zinc-500">
                    <PiClockDuotone className="h-3 w-3" aria-hidden="true" />
                    {listedAgo}
                  </span>
                )}
              </div>

              {/* Seller line */}
              {project?.organizations?.name && (
                <p className="mb-1 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                  {project.organizations.name}
                </p>
              )}

              {/* Name */}
              <h1 className="text-2xl font-bold leading-tight tracking-tight text-stone-900 sm:text-3xl dark:text-white">
                {item.name}
              </h1>

              {/* Price row */}
              <div className="mt-3 flex items-baseline gap-3">
                <span className="text-3xl font-extrabold tabular-nums text-stone-900 dark:text-white">
                  ${item.price.toFixed(2)}
                </span>
                {isBelowMarket && (
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                    Great value
                  </span>
                )}
              </div>

              {/* Condition meter */}
              <div className="mt-3">
                <ConditionMeter condition={item.condition} />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-stone-100 dark:border-zinc-800" />

            {/* CTA */}
            <div>
              {item.status === "available" ? (
                <ItemBuyButton itemId={item.id} price={item.price} maxQuantity={item.quantity ?? 1} />
              ) : (
                <div className="rounded-xl bg-stone-50 px-4 py-4 text-center dark:bg-zinc-800/50">
                  <p className="text-sm font-medium text-stone-500 dark:text-zinc-400">
                    {item.status === "sold"
                      ? "This item has been sold"
                      : "This item is currently reserved"}
                  </p>
                </div>
              )}
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-stone-400 dark:text-zinc-500">
                <PiShieldCheckDuotone className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                Secure checkout
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-stone-400 dark:text-zinc-500">
                <PiCurrencyDollarDuotone className="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
                Powered by Stripe
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-stone-400 dark:text-zinc-500">
                <PiPackageDuotone className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                Estate verified
              </span>
            </div>

            {/* Divider */}
            <div className="border-t border-stone-100 dark:border-zinc-800" />

            {/* Description */}
            {item.description && (
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-zinc-500">
                  About this piece
                </h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-stone-700 dark:text-zinc-300">
                  {item.description}
                </p>
              </div>
            )}

            {/* Details */}
            <div className="rounded-2xl border border-stone-100 bg-stone-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-zinc-500">
                Details
              </h2>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="inline-flex items-center gap-2 text-stone-500 dark:text-zinc-500">
                    <PiTagDuotone className="h-3.5 w-3.5" aria-hidden="true" />
                    Category
                  </dt>
                  <dd className="font-medium text-stone-900 dark:text-white">
                    {item.category}
                  </dd>
                </div>
                <div className="h-px bg-stone-100 dark:bg-zinc-800" />
                <div className="flex items-center justify-between">
                  <dt className="inline-flex items-center gap-2 text-stone-500 dark:text-zinc-500">
                    <PiMedalDuotone className="h-3.5 w-3.5" aria-hidden="true" />
                    Condition
                  </dt>
                  <dd className="font-medium text-stone-900 dark:text-white">
                    {item.condition}
                  </dd>
                </div>
                {item.quantity != null && item.quantity > 1 && (
                  <>
                    <div className="h-px bg-stone-100 dark:bg-zinc-800" />
                    <div className="flex items-center justify-between">
                      <dt className="inline-flex items-center gap-2 text-stone-500 dark:text-zinc-500">
                        <PiPackageDuotone className="h-3.5 w-3.5" aria-hidden="true" />
                        Available
                      </dt>
                      <dd className="font-medium text-stone-900 dark:text-white">
                        {item.quantity} in stock
                      </dd>
                    </div>
                  </>
                )}
                {project && (
                  <>
                    <div className="h-px bg-stone-100 dark:bg-zinc-800" />
                    <div className="flex items-center justify-between">
                      <dt className="inline-flex items-center gap-2 text-stone-500 dark:text-zinc-500">
                        <PiStorefrontDuotone className="h-3.5 w-3.5" aria-hidden="true" />
                        Sale
                      </dt>
                      <dd className="font-medium text-stone-900 dark:text-white">
                        {project.name}
                      </dd>
                    </div>
                  </>
                )}
                {project?.organizations?.name && (
                  <>
                    <div className="h-px bg-stone-100 dark:bg-zinc-800" />
                    <div className="flex items-center justify-between">
                      <dt className="inline-flex items-center gap-2 text-stone-500 dark:text-zinc-500">
                        <PiBuildingsDuotone className="h-3.5 w-3.5" aria-hidden="true" />
                        Seller
                      </dt>
                      <dd className="font-medium text-stone-900 dark:text-white">
                        {project.organizations.name}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
            </div>

            {/* Market Valuation — mobile (below details on small screens) */}
            {insights?.pricePerCondition && (
              <div className="lg:hidden rounded-2xl border border-stone-100 bg-stone-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="mb-4 flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/30">
                    <PiMedalDuotone className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
                      Market Valuation
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-zinc-500">
                      Estimated value by condition
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      ["Excellent", insights.pricePerCondition.excellent],
                      ["Good", insights.pricePerCondition.good],
                      ["Fair", insights.pricePerCondition.fair],
                      ["Poor", insights.pricePerCondition.poor],
                    ] as const
                  ).map(([label, val]) => {
                    const isActive = item.condition === label;
                    return (
                      <div
                        key={label}
                        className={`relative rounded-xl px-3 py-3 text-center transition-all ${
                          isActive
                            ? "bg-white ring-2 ring-indigo-500/30 shadow-sm dark:bg-zinc-800 dark:ring-indigo-400/30"
                            : "bg-white/60 dark:bg-zinc-800/60"
                        }`}
                      >
                        {isActive && (
                          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white dark:bg-indigo-500">
                            This item
                          </div>
                        )}
                        <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 dark:text-zinc-500">
                          {label}
                        </p>
                        <p
                          className={`mt-1 text-base font-bold tabular-nums ${
                            isActive
                              ? "text-indigo-600 dark:text-indigo-400"
                              : "text-stone-600 dark:text-zinc-400"
                          }`}
                        >
                          ${val.toFixed(0)}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {isBelowMarket && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50/80 px-3 py-2.5 dark:bg-emerald-900/20">
                    <PiTrendUpDuotone className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Priced at or below market value
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Bottom spacer for mobile sticky CTA */}
            {item.status === "available" && (
              <div className="h-20 lg:hidden" />
            )}
          </div>
        </div>
      </div>

      {/* Sticky mobile CTA — visible when scrolled past main button */}
      {item.status === "available" && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200/80 bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md lg:hidden dark:border-zinc-800 dark:bg-zinc-900/95 dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-xs text-stone-500 dark:text-zinc-500">
                {item.name}
              </p>
              <p className="text-lg font-extrabold tabular-nums text-stone-900 dark:text-white">
                ${item.price.toFixed(2)}
              </p>
            </div>
            <ItemBuyButton itemId={item.id} price={item.price} maxQuantity={item.quantity ?? 1} compact />
          </div>
        </div>
      )}
    </main>
  );
}
