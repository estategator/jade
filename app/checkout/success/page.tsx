"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { CheckoutMessage } from "@/app/components/checkout-message";

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (sessionId) {
      // Session ID present means Stripe redirected here after a successful payment
      setStatus("success");
    } else {
      setStatus("error");
    }
  }, [sessionId]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand-primary)]" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-zinc-950">
        <CheckoutMessage
          icon={XCircle}
          title="Something went wrong"
          description="We couldn't verify your payment session."
          backLink={{ href: "/inventory", label: "Back to Inventory" }}
          iconColor="text-stone-400 dark:text-zinc-500"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-zinc-950">
      <CheckoutMessage
        icon={CheckCircle}
        title="Payment successful!"
        description="Thank you for your purchase. The item has been marked as sold."
        backLink={{ href: "/inventory", label: "Back to Inventory" }}
      />
    </div>
  );
}
