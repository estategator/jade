"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getStripeAccountStatus, retryStripeOnboarding } from "@/app/organizations/actions";

export default function StripeReturnPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;
  const [status, setStatus] = useState<"loading" | "success" | "incomplete">("loading");
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function verify() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      const result = await getStripeAccountStatus(orgId);
      if (result.data?.onboardingComplete) {
        setStatus("success");
      } else {
        setStatus("incomplete");
      }
    }
    verify();
  }, [orgId, router]);

  async function handleRetryOnboarding() {
    setRetrying(true);
    setError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    const result = await retryStripeOnboarding(orgId, session.user.id);
    if (result.url) {
      window.location.href = result.url;
    } else {
      setError(result.error || "Failed to restart onboarding.");
      setRetrying(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-zinc-950">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        {status === "success" ? (
          <>
            <CheckCircle className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
            <h1 className="text-2xl font-bold text-stone-900 dark:text-white">
              Stripe Connected
            </h1>
            <p className="mt-2 text-sm text-stone-600 dark:text-zinc-400">
              Your Stripe account is linked and ready to accept payments.
            </p>
          </>
        ) : (
          <>
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-stone-400 dark:text-zinc-500" />
            <h1 className="text-2xl font-bold text-stone-900 dark:text-white">
              Setup Incomplete
            </h1>
            <p className="mt-2 text-sm text-stone-600 dark:text-zinc-400">
              Stripe needs more information to finish setting up your account. You can complete it now or come back later from billing settings.
            </p>
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <button
              type="button"
              onClick={handleRetryOnboarding}
              disabled={retrying}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {retrying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Complete Setup
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => router.push(`/organizations/${orgId}/settings/connections/financials`)}
          className="mt-3 inline-flex items-center rounded-xl border border-stone-200 px-5 py-2.5 text-sm font-medium text-stone-700 transition-all hover:border-stone-300 hover:bg-stone-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
        >
          Go to Financial Connections
        </button>
      </div>
    </div>
  );
}
