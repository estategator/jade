"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, Tag } from "lucide-react";

type SoldItem = {
  id: string;
  name: string;
  category: string;
  condition: string;
  price: number;
  status: string;
  thumbnail_url: string | null;
  medium_image_url: string | null;
};

export function SoldItemsSection({
  items,
  soldValue,
}: Readonly<{
  items: SoldItem[];
  soldValue: number;
}>) {
  const [expanded, setExpanded] = useState(true);

  if (items.length === 0) return null;

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-stone-100 p-2 text-stone-500 dark:bg-zinc-800 dark:text-zinc-400">
            <Tag className="h-5 w-5" />
          </div>
          <div className="text-left">
            <h2 className="text-xl font-semibold text-stone-900 dark:text-white">
              Sold{" "}
              <span className="ml-1 inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 dark:bg-zinc-800 dark:text-zinc-400">
                {items.length}
              </span>
            </h2>
            <p className="text-sm text-stone-500 dark:text-zinc-500">
              ${soldValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in completed sales
            </p>
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-stone-400 transition-transform duration-200 dark:text-zinc-500 ${
            expanded ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>

      <div
        className={`grid transition-all duration-300 ease-in-out ${
          expanded
            ? "mt-5 grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const imageUrl = item.medium_image_url || item.thumbnail_url;

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
                        className="object-cover opacity-75 grayscale"
                        sizes="(max-width: 768px) 50vw, 25vw"
                        unoptimized
                      />
                    ) : null}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-stone-900/40 to-transparent p-3 dark:from-zinc-950/50">
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-500 ring-1 ring-stone-300 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700">
                        Sold
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3 p-5">
                    <div>
                      <p className="text-base font-semibold text-stone-900 dark:text-white">
                        {item.name}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-zinc-500">
                        {item.category}
                      </p>
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
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
