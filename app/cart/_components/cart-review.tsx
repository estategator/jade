"use client";

import { useState, startTransition } from "react";
import { ViewTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  PiShoppingCartDuotone,
  PiTrashDuotone,
  PiMinusDuotone,
  PiPlusDuotone,
  PiSpinnerDuotone,
  PiImageBrokenDuotone,
  PiArrowLeftDuotone,
  PiWarningDuotone,
} from "react-icons/pi";
import { PageHeader } from "@/app/components/page-header";
import { useCart } from "@/lib/cart-context";

export function CartReview() {
  const { items, loading, removeItem, updateQuantity, clear } = useCart();
  const [clearing, setClearing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const validItems = items.filter((ci) => ci.inventory_item?.status === "available");
  const invalidItems = items.filter((ci) => ci.inventory_item?.status !== "available");
  const subtotal = validItems.reduce((sum, ci) => {
    return sum + (ci.inventory_item?.price ?? 0) * ci.quantity;
  }, 0);

  function handleUpdateQty(cartItemId: string, qty: number) {
    updateQuantity(cartItemId, qty).then((result) => {
      if (result.error) setError(result.error);
    });
  }

  function handleRemove(cartItemId: string) {
    removeItem(cartItemId);
  }

  async function handleClear() {
    setClearing(true);
    await clear();
    setClearing(false);
  }

  async function handleCheckout() {
    if (!validItems.length) return;
    setChecking(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromCart: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start checkout.");
        setChecking(false);
        return;
      }
      if (data.url) {
        window.location.assign(data.url);
      }
    } catch {
      setError("Failed to start checkout.");
      setChecking(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <PiSpinnerDuotone className="h-8 w-8 animate-spin text-stone-400 dark:text-zinc-600" />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Your Cart"
        description={
          items.length > 0
            ? `${items.length} ${items.length === 1 ? "item" : "items"} in your cart`
            : "Your cart is empty"
        }
      />

      {error && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400"
        >
          {error}
        </motion.p>
      )}

      {items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900"
        >
          <PiShoppingCartDuotone className="mx-auto mb-4 h-10 w-10 text-stone-400 dark:text-zinc-600" />
          <h3 className="text-lg font-bold text-stone-900 dark:text-white">
            Your cart is empty
          </h3>
          <p className="mt-2 text-sm text-stone-600 dark:text-zinc-400">
            Browse your inventory and add items to get started.
          </p>
            <Link
            href="/inventory"
            transitionTypes={['nav-back']}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-primary)] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[var(--color-brand-primary-hover)]"
          >
            <PiArrowLeftDuotone className="h-4 w-4" />
            Back to Inventory
          </Link>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {/* Invalid items warning */}
          {invalidItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/30"
            >
              <div className="flex items-center gap-2 mb-2">
                <PiWarningDuotone className="h-4 w-4 text-red-600 dark:text-red-400" />
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  {invalidItems.length} {invalidItems.length === 1 ? "item is" : "items are"} no longer available
                </p>
              </div>
              <p className="text-xs text-red-600 dark:text-red-400">
                These items will not be included in checkout. Please remove them from your cart.
              </p>
            </motion.div>
          )}

          {/* Cart items */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          >
            <ul className="divide-y divide-stone-100 dark:divide-zinc-800/50">
              {items.map((ci) => {
                const item = ci.inventory_item;
                if (!item) return null;
                const imageUrl = item.thumbnail_url || item.medium_image_url;
                const maxQty = item.quantity;
                const isUnavailable = item.status !== "available";

                return (
                  <ViewTransition key={ci.id} default="none">
                  <li
                    className={`px-5 py-4 ${isUnavailable ? "opacity-60" : ""}`}
                  >
                    <div className="flex gap-4">
                      {/* Thumbnail */}
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 dark:border-zinc-700 dark:bg-zinc-800">
                        {imageUrl ? (
                          <Image
                            src={imageUrl}
                            alt={item.name}
                            width={64}
                            height={64}
                            className="h-16 w-16 rounded-xl object-cover"
                            unoptimized
                          />
                        ) : (
                          <PiImageBrokenDuotone className="h-6 w-6 text-stone-400 dark:text-zinc-600" />
                        )}
                      </div>

                      {/* Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              href={`/inventory/${item.id}`}
                              title={item.name}
                              className="line-clamp-2 block break-words text-sm font-semibold text-stone-900 hover:text-[var(--color-brand-primary)] dark:text-white dark:hover:text-[var(--color-brand-primary)]"
                            >
                              {item.name}
                            </Link>
                            <p className="truncate text-xs text-stone-500 dark:text-zinc-400">
                              {[item.category, item.condition].filter(Boolean).join(" · ")}
                            </p>
                            {isUnavailable && (
                              <p className="mt-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                                No longer available
                              </p>
                            )}
                          </div>
                          <p className="shrink-0 text-sm font-bold text-stone-900 dark:text-white">
                            ${(item.price * ci.quantity).toFixed(2)}
                          </p>
                        </div>

                        {/* Quantity controls */}
                        {!isUnavailable && (
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQty(ci.id, ci.quantity - 1)}
                                  disabled={ci.quantity <= 1}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-300 text-stone-500 transition-colors hover:bg-stone-50 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-700"
                                >
                                  <PiMinusDuotone className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-8 text-center text-sm font-bold text-stone-900 dark:text-white">
                                  {ci.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQty(ci.id, ci.quantity + 1)}
                                  disabled={ci.quantity >= maxQty}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-300 text-stone-500 transition-colors hover:bg-stone-50 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-700"
                                >
                                  <PiPlusDuotone className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => startTransition(() => { handleRemove(ci.id); })}
                                className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                                title="Remove"
                              >
                                <PiTrashDuotone className="h-4 w-4" />
                              </button>
                            </div>
                            <p className="text-xs text-stone-400 dark:text-zinc-500">
                              {maxQty} available · ${item.price.toFixed(2)} each
                            </p>
                          </div>
                        )}

                        {/* Remove only for unavailable */}
                        {isUnavailable && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => handleRemove(ci.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/40"
                            >
                              <PiTrashDuotone className="h-3.5 w-3.5" />
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                  </ViewTransition>
                );
              })}
            </ul>
          </motion.div>

          {/* Summary + Checkout */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-stone-600 dark:text-zinc-400">
                Subtotal ({validItems.length} {validItems.length === 1 ? "item" : "items"})
              </span>
              <span className="text-xl font-bold text-stone-900 dark:text-white">
                ${subtotal.toFixed(2)}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={checking || !validItems.length}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[var(--color-brand-primary)] px-5 py-3.5 text-base font-bold text-white shadow-sm transition-all hover:bg-[var(--color-brand-primary-hover)] hover:shadow-md active:scale-[0.98] disabled:opacity-50"
            >
              {checking ? (
                <PiSpinnerDuotone className="h-5 w-5 animate-spin" />
              ) : (
                <PiShoppingCartDuotone className="h-5 w-5" />
              )}
              Checkout &mdash; ${subtotal.toFixed(2)}
            </button>

            <div className="mt-3 flex items-center justify-between">
              <Link
                href="/inventory"
                transitionTypes={['nav-back']}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-brand-primary)] transition-colors hover:text-[var(--color-brand-primary-hover)] dark:text-[var(--color-brand-primary)] dark:hover:text-[var(--color-brand-primary-hover)]"
              >
                <PiArrowLeftDuotone className="h-3.5 w-3.5" />
                Continue shopping
              </Link>
              <button
                type="button"
                onClick={handleClear}
                disabled={clearing}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 transition-colors hover:text-stone-700 disabled:opacity-50 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                {clearing && <PiSpinnerDuotone className="h-3 w-3 animate-spin" />}
                Clear cart
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}
