"use client";

import { useState } from "react";
import { Loader2, ShoppingCart, Minus, Plus } from "lucide-react";

type ItemBuyButtonProps = Readonly<{
  itemId: string;
  price: number;
  maxQuantity: number;
  compact?: boolean;
}>;

export function ItemBuyButton({ itemId, price, maxQuantity, compact }: ItemBuyButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState(1);

  const clampedMax = Math.max(1, maxQuantity);

  async function handleBuy() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, quantity }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start checkout.");
        setLoading(false);
        return;
      }
      if (data.url) {
        window.location.assign(data.url);
      }
    } catch {
      setError("Failed to start checkout.");
      setLoading(false);
    }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {clampedMax > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1 || loading}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 text-stone-600 transition-colors hover:bg-stone-50 active:bg-stone-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-base font-bold text-stone-900 dark:text-white">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(clampedMax, q + 1))}
              disabled={quantity >= clampedMax || loading}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 text-stone-600 transition-colors hover:bg-stone-50 active:bg-stone-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={handleBuy}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShoppingCart className="h-4 w-4" />
          )}
          Buy{quantity > 1 ? ` (${quantity})` : ""}
        </button>
        {clampedMax === 1 && (
          <span className="text-xs text-stone-400 dark:text-zinc-500">1 available</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {clampedMax > 1 ? (
        <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-5 py-3.5 dark:border-zinc-700 dark:bg-zinc-800">
          <span className="text-sm font-medium text-stone-600 dark:text-zinc-400">Quantity</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1 || loading}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-stone-300 text-stone-600 transition-colors hover:bg-white active:bg-stone-100 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
            >
              <Minus className="h-5 w-5" />
            </button>
            <span className="w-10 text-center text-lg font-bold tabular-nums text-stone-900 dark:text-white">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(clampedMax, q + 1))}
              disabled={quantity >= clampedMax || loading}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-stone-300 text-stone-600 transition-colors hover:bg-white active:bg-stone-100 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:active:bg-zinc-600"
            >
              <Plus className="h-5 w-5" />
            </button>
            <span className="text-sm text-stone-400 dark:text-zinc-500">
              of {clampedMax}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-5 py-3.5 dark:border-zinc-700 dark:bg-zinc-800">
          <span className="text-sm font-medium text-stone-600 dark:text-zinc-400">Quantity</span>
          <span className="text-sm font-medium text-stone-700 dark:text-zinc-300">1 available</span>
        </div>
      )}
      <button
        type="button"
        onClick={handleBuy}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-indigo-600 px-5 py-3.5 text-base font-bold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ShoppingCart className="h-5 w-5" />
        )}
        Buy{quantity > 1 ? ` ${quantity}` : ""} &mdash; ${(price * quantity).toFixed(2)}
      </button>
      {error && (
        <p className="text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
