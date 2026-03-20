"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { XCircle } from "lucide-react";
import { CheckoutMessage } from "@/app/components/checkout-message";

export default function CheckoutCancelPage() {
  const searchParams = useSearchParams();
  const itemId = searchParams.get("item_id");

  useEffect(() => {
    // Release the reservation on cancel by notifying the server
    if (itemId) {
      fetch("/api/checkout/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      }).catch(() => {
        // Stripe webhook expiry will handle this as a fallback
      });
    }
  }, [itemId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-zinc-950">
      <CheckoutMessage
        icon={XCircle}
        title="Checkout cancelled"
        description="Your payment was not processed. The item is still available."
        backLink={{ href: "/inventory", label: "Back to Inventory" }}
        iconColor="text-stone-400 dark:text-zinc-500"
      />
    </div>
  );
}
