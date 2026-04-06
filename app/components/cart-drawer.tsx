"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  PiShoppingCartDuotone,
  PiXDuotone,
  PiTrashDuotone,
  PiMinusDuotone,
  PiPlusDuotone,
  PiSpinnerDuotone,
  PiImageBrokenDuotone,
} from "react-icons/pi";
import { useCart } from "@/lib/cart-context";
import { Drawer } from "@/app/components/ui/drawer";

export function CartDrawer() {
  const { items, count, loading, removeItem, updateQuantity, clear } = useCart();
  const [open, setOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const subtotal = items.reduce((sum, ci) => {
    const price = ci.inventory_item?.price ?? 0;
    return sum + price * ci.quantity;
  }, 0);

  function handleUpdateQty(cartItemId: string, qty: number) {
    updateQuantity(cartItemId, qty);
  }

  function handleRemove(cartItemId: string) {
    removeItem(cartItemId);
  }

  async function handleClear() {
    setClearing(true);
    await clear();
    setClearing(false);
  }

  return (
    <>
      {/* Cart toggle button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative inline-flex items-center justify-center rounded-xl p-2 text-stone-600 transition-colors hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        title="Shopping cart"
      >
        <PiShoppingCartDuotone className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>

      {/* Backdrop + Drawer */}
      <Drawer open={open}>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <PiShoppingCartDuotone className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                    Cart
                    {count > 0 && (
                      <span className="ml-1.5 text-sm font-normal text-stone-500 dark:text-zinc-400">
                        ({count} {count === 1 ? "item" : "items"})
                      </span>
                    )}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  <PiXDuotone className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <PiSpinnerDuotone className="h-6 w-6 animate-spin text-stone-400 dark:text-zinc-600" />
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <PiShoppingCartDuotone className="mb-3 h-10 w-10 text-stone-300 dark:text-zinc-700" />
                    <p className="text-sm font-medium text-stone-500 dark:text-zinc-400">
                      Your cart is empty
                    </p>
                    <p className="mt-1 text-xs text-stone-400 dark:text-zinc-500">
                      Add items from the inventory to get started.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {items.map((ci) => {
                      const item = ci.inventory_item;
                      if (!item) return null;
                      const imageUrl = item.thumbnail_url || item.medium_image_url;
                      const maxQty = item.quantity;
                      const isUnavailable = item.status !== "available";

                      return (
                        <li
                          key={ci.id}
                          className={`rounded-xl border p-3 transition-colors ${
                            isUnavailable
                              ? "border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20"
                              : "border-stone-200 bg-stone-50 dark:border-zinc-800 dark:bg-zinc-800/50"
                          }`}
                        >
                          <div className="flex gap-3">
                            {/* Thumbnail */}
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
                              {imageUrl ? (
                                <Image
                                  src={imageUrl}
                                  alt={item.name}
                                  width={48}
                                  height={48}
                                  className="h-12 w-12 rounded-lg object-cover"
                                  unoptimized
                                />
                              ) : (
                                <PiImageBrokenDuotone className="h-5 w-5 text-stone-400 dark:text-zinc-600" />
                              )}
                            </div>

                            {/* Details */}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-stone-900 dark:text-white">
                                {item.name}
                              </p>
                              <p className="text-xs text-stone-500 dark:text-zinc-400">
                                ${item.price.toFixed(2)} each
                              </p>
                              {isUnavailable && (
                                <p className="mt-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                                  No longer available
                                </p>
                              )}
                            </div>

                            {/* Remove */}
                            <button
                              type="button"
                              onClick={() => handleRemove(ci.id)}
                              className="shrink-0 rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-200 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-red-400"
                              title="Remove from cart"
                            >
                              <PiTrashDuotone className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Quantity + Line total */}
                          {!isUnavailable && (
                            <div className="mt-2 flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQty(ci.id, ci.quantity - 1)}
                                  disabled={ci.quantity <= 1}
                                  className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-300 text-stone-500 transition-colors hover:bg-white disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-700"
                                >
                                  <PiMinusDuotone className="h-3 w-3" />
                                </button>
                                <span className="w-6 text-center text-sm font-bold text-stone-900 dark:text-white">
                                  {ci.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQty(ci.id, ci.quantity + 1)}
                                  disabled={ci.quantity >= maxQty}
                                  className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-300 text-stone-500 transition-colors hover:bg-white disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-700"
                                >
                                  <PiPlusDuotone className="h-3 w-3" />
                                </button>
                                <span className="ml-1 text-xs text-stone-400 dark:text-zinc-500">
                                  of {maxQty}
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-stone-900 dark:text-white">
                                ${(item.price * ci.quantity).toFixed(2)}
                              </p>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Footer */}
              {items.length > 0 && (
                <div className="border-t border-stone-200 px-5 py-4 dark:border-zinc-800">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm text-stone-600 dark:text-zinc-400">Subtotal</span>
                    <span className="text-lg font-bold text-stone-900 dark:text-white">
                      ${subtotal.toFixed(2)}
                    </span>
                  </div>
                  <Link
                    href="/cart"
                    onClick={() => setOpen(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-indigo-700 hover:shadow-md active:scale-[0.98]"
                  >
                    Review &amp; Checkout
                  </Link>
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={clearing}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  >
                    {clearing && <PiSpinnerDuotone className="h-3 w-3 animate-spin" />}
                    Clear cart
                  </button>
                </div>
              )}
      </Drawer>
    </>
  );
}
