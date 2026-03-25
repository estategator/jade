"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, Loader2, XCircle, FileText } from "lucide-react";
import { CheckoutMessage } from "@/app/components/checkout-message";
import { getInvoiceByStripeSession } from "@/app/invoices/actions";

const AUTO_REDIRECT_SECONDS = 10;

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [invoice, setInvoice] = useState<{ id: string; invoice_number: string } | null>(null);
  const [countdown, setCountdown] = useState(AUTO_REDIRECT_SECONDS);

  // Poll for the invoice (webhook fires asynchronously)
  const pollForInvoice = useCallback(async () => {
    if (!sessionId) return;
    for (let i = 0; i < 15; i++) {
      const result = await getInvoiceByStripeSession(sessionId);
      if (result.data) {
        setInvoice(result.data);
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      setStatus("success");
      pollForInvoice();
    } else {
      setStatus("error");
    }
  }, [sessionId, pollForInvoice]);

  // Countdown timer
  useEffect(() => {
    if (status !== "success") return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  // Redirect when countdown hits 0
  useEffect(() => {
    if (countdown === 0) {
      router.push("/inventory");
    }
  }, [countdown, router]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center px-4 py-24">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand-primary)]" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center justify-center px-4 py-24">
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
    <div className="flex items-center justify-center px-4 py-24">
      <div className="text-center">
        <CheckoutMessage
          icon={CheckCircle}
          title="Payment successful!"
          description="Thank you for your purchase. The items have been marked as sold."
          backLink={{ href: "/inventory", label: "Back to Inventory" }}
        />

        {invoice ? (
          <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm dark:border-emerald-800/50 dark:bg-emerald-900/20">
            <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-stone-700 dark:text-zinc-300">
              Invoice{" "}
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {invoice.invoice_number}
              </span>{" "}
              has been generated
            </span>
          </div>
        ) : (
          <div className="mt-6 inline-flex items-center gap-2 text-sm text-stone-400 dark:text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Generating invoice…
          </div>
        )}

        <p className="mt-4 text-xs text-stone-400 dark:text-zinc-500">
          Redirecting to inventory in {countdown}s…
        </p>
      </div>
    </div>
  );
}
