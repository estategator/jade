"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ExternalLink, Loader2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { retryStripeOnboarding } from "@/app/organizations/actions";

type StripeOnboardingBannerProps = Readonly<{
  orgId: string;
  canManageBilling: boolean;
}>;

export function StripeOnboardingBanner({
  orgId,
  canManageBilling,
}: StripeOnboardingBannerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  async function handleRetry() {
    setLoading(true);
    setError("");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    const result = await retryStripeOnboarding(orgId, session.user.id);
    if (result.url) {
      window.location.href = result.url;
    } else {
      setError(result.error || "Failed to restart onboarding.");
      setLoading(false);
    }
  }

  return (
    <div className="relative rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-2 rounded-md p-1 text-stone-400 hover:text-stone-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-stone-500 dark:text-zinc-400" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-stone-900 dark:text-white">
            Stripe onboarding incomplete
          </p>
          <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
            Stripe needs more information before you can accept payouts. Complete the setup to start receiving payments.
          </p>
          {error && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
          {canManageBilling && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={loading}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ExternalLink className="h-3.5 w-3.5" />
              )}
              Complete Stripe Setup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
