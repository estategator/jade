import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  MapPin,
  Phone,
  Building2,
  Tag,
  Layers,
  ShieldCheck,
  Store,
} from "lucide-react";
import { getPublicProject, getPublicProjectItems } from "@/app/sales/actions";
import type { PublicProjectItem } from "@/app/sales/actions";
import { createClient } from "@/utils/supabase/server";

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
      "bg-[var(--color-brand-subtle)] text-[var(--color-brand-primary)] ring-1 ring-[var(--color-brand-primary)]/20",
    dot: "bg-[var(--color-brand-primary)]",
  },
};

function formatAddress(project: {
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
}): string | null {
  const parts: string[] = [];
  if (project.address_line1) parts.push(project.address_line1);
  if (project.address_line2) parts.push(project.address_line2);

  const cityStateZip: string[] = [];
  if (project.city) cityStateZip.push(project.city);
  if (project.state)
    cityStateZip.push(cityStateZip.length > 0 ? `, ${project.state}` : project.state);
  if (project.zip_code) cityStateZip.push(` ${project.zip_code}`);

  if (cityStateZip.length > 0) parts.push(cityStateZip.join(""));

  return parts.length > 0 ? parts.join(", ") : null;
}

function ItemCard({ item }: Readonly<{ item: PublicProjectItem }>) {
  const status = statusConfig[item.status] ?? statusConfig.available;
  const displayImage = item.medium_image_url || item.thumbnail_url;

  return (
    <Link
      href={`/items/${item.id}`}
      className="group overflow-hidden rounded-2xl border border-stone-200 bg-white transition-all hover:border-[var(--color-brand-primary)]/20 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-[var(--color-brand-primary)]/40"
    >
      {/* Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-stone-100 dark:bg-zinc-800">
        {displayImage ? (
          <Image
            src={displayImage}
            alt={item.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Layers className="h-10 w-10 text-stone-300 dark:text-zinc-600" />
          </div>
        )}

        {/* Status badge overlay */}
        <div className="absolute left-2.5 top-2.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold backdrop-blur-sm ${status.className}`}
          >
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-stone-900 line-clamp-1 dark:text-white">
          {item.name}
        </h3>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-lg font-bold text-stone-900 dark:text-white">
            ${item.price.toFixed(2)}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-[11px] text-stone-500 dark:text-zinc-500">
            <Tag className="h-3 w-3" />
            {item.category}
          </span>
          <span className="text-[11px] font-medium text-stone-400 dark:text-zinc-600">
            {item.condition}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default async function PublicProjectSalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Authenticated users can view any project (even unpublished drafts)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  const [projectResult, itemsResult] = await Promise.all([
    getPublicProject(id, { skipPublishedCheck: isAuthenticated }),
    getPublicProjectItems(id),
  ]);

  if (!projectResult.data) {
    notFound();
  }

  const project = projectResult.data;
  const items = itemsResult.data ?? [];
  const availableItems = items.filter((i) => i.status === "available");
  const soldItems = items.filter((i) => i.status === "sold");
  const address = formatAddress(project);

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-zinc-950">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden">
        {/* Background image / gradient */}
        {project.cover_image_url ? (
          <>
            <div className="absolute inset-0">
              <Image
                src={project.cover_image_url}
                alt=""
                fill
                className="object-cover"
                priority
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-b from-stone-900/70 via-stone-900/50 to-stone-50 dark:from-zinc-950/80 dark:via-zinc-950/60 dark:to-zinc-950" />
            </div>
            <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-20 sm:px-6 sm:pb-20 sm:pt-28 lg:px-8">
              <HeroContent project={project} address={address} itemCount={availableItems.length} />
            </div>
          </>
        ) : (
          <div className="bg-gradient-to-b from-[var(--color-brand-subtle)] via-stone-50 to-stone-50 dark:from-[var(--color-brand-primary)]/5 dark:via-zinc-950 dark:to-zinc-950">
            <div className="mx-auto max-w-5xl px-4 pb-16 pt-20 sm:px-6 sm:pb-20 sm:pt-28 lg:px-8">
              <HeroContent project={project} address={address} itemCount={availableItems.length} />
            </div>
          </div>
        )}
      </div>

      {/* ── Items grid ── */}
      <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        {/* Stats bar */}
        <div className="mb-8 flex flex-wrap items-center gap-4 border-b border-stone-200 pb-6 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
              <Store className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-stone-500 dark:text-zinc-500">Available</p>
              <p className="text-sm font-bold text-stone-900 dark:text-white">{availableItems.length}</p>
            </div>
          </div>
          {soldItems.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 dark:bg-zinc-800">
                <Tag className="h-4 w-4 text-stone-500 dark:text-zinc-400" />
              </div>
              <div>
                <p className="text-xs text-stone-500 dark:text-zinc-500">Sold</p>
                <p className="text-sm font-bold text-stone-900 dark:text-white">{soldItems.length}</p>
              </div>
            </div>
          )}
          <div className="ml-auto flex items-center gap-1.5 text-xs text-stone-500 dark:text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Secure checkout powered by Stripe
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-16 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <Layers className="mx-auto mb-4 h-12 w-12 text-stone-300 dark:text-zinc-600" />
            <h3 className="text-lg font-bold text-stone-900 dark:text-white">
              Items coming soon
            </h3>
            <p className="mt-2 text-sm text-stone-500 dark:text-zinc-400">
              This sale is being prepared. Check back soon for available items.
            </p>
          </div>
        ) : (
          <>
            {/* Available items */}
            {availableItems.length > 0 && (
              <section>
                <h2 className="mb-5 text-lg font-bold text-stone-900 dark:text-white">
                  Available Items
                </h2>
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                  {availableItems.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}

            {/* Sold items */}
            {soldItems.length > 0 && (
              <section className="mt-12">
                <h2 className="mb-5 text-lg font-bold text-stone-500 dark:text-zinc-500">
                  Sold
                </h2>
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 opacity-60">
                  {soldItems.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

// ── Hero content (reusable between image/gradient backgrounds) ──

function HeroContent({
  project,
  address,
  itemCount,
}: Readonly<{
  project: { name: string; description: string; phone: string | null; organization: { name: string } | null; cover_image_url: string | null };
  address: string | null;
  itemCount: number;
}>) {
  const hasImage = !!project.cover_image_url;

  return (
    <div className="max-w-2xl">
      {/* Org badge */}
      {project.organization && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-xs font-medium text-stone-700 shadow-sm backdrop-blur-sm dark:bg-zinc-800/90 dark:text-zinc-300">
          <Building2 className="h-3.5 w-3.5" />
          {project.organization.name}
        </div>
      )}

      {/* Title */}
      <h1
        className={`text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl ${
          hasImage ? "text-white" : "text-stone-900 dark:text-white"
        }`}
      >
        {project.name}
      </h1>

      {/* Description */}
      {project.description && (
        <p
          className={`mt-4 max-w-xl text-base leading-relaxed sm:text-lg ${
            hasImage
              ? "text-stone-200"
              : "text-stone-600 dark:text-zinc-400"
          }`}
        >
          {project.description}
        </p>
      )}

      {/* Meta row */}
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
        {address && (
          <span
            className={`inline-flex items-center gap-1.5 text-sm ${
              hasImage
                ? "text-stone-300"
                : "text-stone-500 dark:text-zinc-400"
            }`}
          >
            <MapPin className="h-4 w-4" />
            {address}
          </span>
        )}
        {project.phone && (
          <a
            href={`tel:${project.phone}`}
            className={`inline-flex items-center gap-1.5 text-sm transition-colors hover:underline ${
              hasImage
                ? "text-stone-300 hover:text-white"
                : "text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            <Phone className="h-4 w-4" />
            {project.phone}
          </a>
        )}
      </div>

      {/* Item count CTA */}
      <div className="mt-8">
        <span
          className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm ${
            hasImage
              ? "bg-white text-stone-900 hover:bg-stone-50"
              : "bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-primary-hover)]"
          }`}
        >
          <Store className="h-4 w-4" />
          {itemCount} {itemCount === 1 ? "item" : "items"} for sale
        </span>
      </div>
    </div>
  );
}
