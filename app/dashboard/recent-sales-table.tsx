"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Star } from "lucide-react";

import type { Sale } from "@/app/dashboard/actions";
import {
  toggleStarClientProfile,
  starBuyerByEmail,
} from "@/app/onboarding/actions";

export function RecentSalesTable({
  sales,
}: Readonly<{
  sales: Sale[];
}>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleToggleStar = (sale: Sale) => {
    startTransition(async () => {
      if (sale.client_profile_id) {
        await toggleStarClientProfile(sale.client_profile_id);
      } else if (sale.buyer_email) {
        await starBuyerByEmail(sale.buyer_email);
      }
      router.refresh();
    });
  };

  return (
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
      {sales.map((sale) => (
        <div
          key={sale.id}
          className="grid grid-cols-1 gap-2 border-b border-stone-100 px-5 py-3.5 last:border-b-0 sm:grid-cols-12 sm:items-center sm:gap-4 dark:border-zinc-800/50"
        >
          <p className="col-span-4 text-sm font-medium text-stone-900 dark:text-white">
            {sale.inventory_items?.name ?? "Unknown item"}
          </p>
          <div className="col-span-3 flex items-center gap-1.5">
            {sale.buyer_email && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleToggleStar(sale)}
                className={`shrink-0 rounded p-0.5 transition disabled:opacity-60 ${
                  sale.is_starred
                    ? "text-amber-500 hover:text-amber-600 dark:text-amber-400"
                    : "text-stone-300 hover:text-amber-500 dark:text-zinc-600 dark:hover:text-amber-400"
                }`}
                title={sale.is_starred ? "Remove from frequents" : "Add to frequents"}
              >
                <Star className={`h-3.5 w-3.5 ${sale.is_starred ? "fill-current" : ""}`} />
              </button>
            )}
            <p className="truncate text-sm text-stone-600 dark:text-zinc-400">
              {sale.buyer_email ?? "—"}
            </p>
          </div>
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
  );
}
