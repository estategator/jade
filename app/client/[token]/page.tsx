import Image from "next/image";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, Package, ShieldCheck, Tag } from "lucide-react";

import { getClientProjectShareView } from "@/app/onboarding/actions";
import { SoldItemsSection } from "./_components/sold-items-section";

export const dynamic = "force-dynamic";

const statusClasses: Record<string, string> = {
  available:
    "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-900/20 dark:text-emerald-300",
  sold: "bg-stone-100 text-stone-500 ring-1 ring-stone-300 dark:bg-zinc-800 dark:text-zinc-400",
  reserved:
    "bg-[var(--color-brand-subtle)] text-[var(--color-brand-primary)] ring-1 ring-[var(--color-brand-primary)]/20",
};

export default async function ClientProjectSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getClientProjectShareView(token);

  if (!("data" in result)) {
    notFound();
  }

  const { client, project, workflow, items } = result.data;
  const soldItemsList = items.filter((item) => item.status === "sold");
  const availableItemsList = items.filter((item) => item.status !== "sold");
  const availableCount = items.filter((item) => item.status === "available").length;
  const soldCount = soldItemsList.length;

  const totalValue = items.reduce((sum, item) => sum + (item.price ?? 0), 0);
  const availableValue = items.filter((i) => i.status === "available").reduce((sum, i) => sum + (i.price ?? 0), 0);
  const soldValue = soldItemsList.reduce((sum, i) => sum + (i.price ?? 0), 0);

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-zinc-950">
      <section className="relative overflow-hidden border-b border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.16),_transparent_45%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.16),_transparent_45%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold tracking-tight text-stone-900 dark:text-white">
              {project.name}
            </h1>
            <p className="mt-3 text-base text-stone-600 dark:text-zinc-400">
              {project.description || `Progress tracking and inventory transparency for ${client.fullName}.`}
            </p>

            <div className="mt-6 flex flex-wrap gap-3 text-sm text-stone-600 dark:text-zinc-400">
              <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
                Client: {client.fullName}
              </span>
              <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
                Workflow progress: {workflow.progressPercent}%
              </span>
              <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
                Stage: {workflow.stage.replaceAll("_", " ")}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm text-stone-500 dark:text-zinc-500">Total items</p>
              <p className="mt-2 text-2xl font-bold text-stone-900 dark:text-white">{items.length}</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm text-stone-500 dark:text-zinc-500">Available</p>
              <p className="mt-2 text-2xl font-bold text-stone-900 dark:text-white">{availableCount}</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm text-stone-500 dark:text-zinc-500">Sold</p>
              <p className="mt-2 text-2xl font-bold text-stone-900 dark:text-white">{soldCount}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-[var(--color-brand-subtle)] p-2 text-[var(--color-brand-primary)]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-stone-900 dark:text-white">
                  Project progress
                </h2>
                <p className="text-sm text-stone-500 dark:text-zinc-500">
                  This checklist shows how the sale is moving forward.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {workflow.steps.map((step) => {
                const complete = step.status === "completed";

                return (
                  <div
                    key={step.id}
                    className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    {complete ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
                    ) : (
                      <Circle className="mt-0.5 h-5 w-5 text-stone-300 dark:text-zinc-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-stone-900 dark:text-white">{step.title}</p>
                      <p className="text-xs text-stone-500 dark:text-zinc-500">{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-stone-900 dark:text-white">
                  Inventory and pricing
                </h2>
                <p className="text-sm text-stone-500 dark:text-zinc-500">
                  Review the items currently prepared for the sale.
                </p>
              </div>
            </div>

            <div className="mb-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-xs font-medium text-stone-500 dark:text-zinc-500">Total estimated value</p>
                <p className="mt-1 text-lg font-bold text-stone-900 dark:text-white">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-xs font-medium text-stone-500 dark:text-zinc-500">For sale</p>
                <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">${availableValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-xs font-medium text-stone-500 dark:text-zinc-500">Sold</p>
                <p className="mt-1 text-lg font-bold text-stone-900 dark:text-white">${soldValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>

          <SoldItemsSection items={soldItemsList} soldValue={soldValue} />

          <div className="rounded-3xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-stone-900 dark:text-white">
                  Available items
                </h2>
                <p className="text-sm text-stone-500 dark:text-zinc-500">
                  Items currently for sale.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {availableItemsList.length === 0 ? (
                <div className="sm:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500 dark:border-zinc-700 dark:text-zinc-500">
                  Inventory details will appear here once items are added.
                </div>
              ) : (
                availableItemsList.map((item) => {
                  const imageUrl = item.medium_image_url || item.thumbnail_url;
                  const statusClass = statusClasses[item.status] ?? statusClasses.available;

                  return (
                    <article
                      key={item.id}
                      className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <div className="relative aspect-[4/3] bg-stone-100 dark:bg-zinc-900">
                        {imageUrl ? (
                          <Image
                            src={imageUrl}
                            alt={item.name}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 50vw, 25vw"
                            unoptimized
                          />
                        ) : null}
                      </div>
                      <div className="space-y-3 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-stone-900 dark:text-white">{item.name}</p>
                            <p className="text-xs text-stone-500 dark:text-zinc-500">{item.category}</p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass}`}>
                            {item.status}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm text-stone-600 dark:text-zinc-400">
                          <span className="inline-flex items-center gap-1">
                            <Tag className="h-3.5 w-3.5" />
                            {item.condition}
                          </span>
                          <span className="text-base font-bold text-stone-900 dark:text-white">
                            ${item.price.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
      </section>
    </main>
  );
}