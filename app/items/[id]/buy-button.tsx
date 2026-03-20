"use client";

import { useState } from "react";
import { Loader2, ShoppingCart } from "lucide-react";

type ItemBuyButtonProps = Readonly<{
  itemId: string;
  price: number;
  compact?: boolean;
}>;

export function ItemBuyButton({ itemId, price, compact }: ItemBuyButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleBuy() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
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
        Buy
      </button>
    );
  }

  return (
    <div className="space-y-2">
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
        Buy Now &mdash; ${price.toFixed(2)}
      </button>
      {error && (
        <p className="text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
