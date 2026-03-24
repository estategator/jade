"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { XCircle } from "lucide-react";
import { CheckoutMessage } from "@/app/components/checkout-message";

export function CancelRestorer() {
  const searchParams = useSearchParams();
  const itemId = searchParams.get("item_id");
  const qty = parseInt(searchParams.get("qty") ?? "1", 10) || 1;
  const csId = searchParams.get("cs_id");
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    if (csId) {
      // Multi-item cancel via checkout session
      fetch("/api/checkout/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutSessionId: csId }),
      }).catch((err) => {
        console.error("[cancel-restorer] Failed to release reservation:", err);
      });
    } else if (itemId) {
      // Legacy single-item cancel
      fetch("/api/checkout/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, quantity: qty }),
      }).catch((err) => {
        console.error("[cancel-restorer] Failed to release reservation:", err);
      });
    }
  }, [itemId, qty, csId]);

  return (
    <CheckoutMessage
      icon={XCircle}
      title="Checkout cancelled"
      description="Your payment was not processed. The items are still available."
      backLink={{ href: "/inventory", label: "Back to Inventory" }}
      iconColor="text-stone-400 dark:text-zinc-500"
    />
  );
}
