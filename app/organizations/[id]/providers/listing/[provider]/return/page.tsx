"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { completeOAuthConnection } from "@/app/organizations/listing-provider-actions";
import { LISTING_PROVIDER_DISPLAY, type ListingProvider } from "@/lib/listing-providers/types";

const VALID_PROVIDERS = new Set<string>(["whatnot", "etsy", "ebay"]);

export default function ListingProviderReturnPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgId = params.id as string;
  const provider = params.provider as string;
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [error, setError] = useState("");

  const providerInfo = VALID_PROVIDERS.has(provider)
    ? LISTING_PROVIDER_DISPLAY[provider as ListingProvider]
    : null;
  const providerName = providerInfo?.name ?? provider;

  useEffect(() => {
    async function handleCallback() {
      if (!VALID_PROVIDERS.has(provider)) {
        setError("Unknown listing provider.");
        setStatus("error");
        return;
      }

      const code = searchParams.get("code");
      const state = searchParams.get("state");

      if (!code || !state) {
        setError("Missing authorization code. Please try connecting again.");
        setStatus("error");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      const result = await completeOAuthConnection(
        orgId,
        session.user.id,
        provider as ListingProvider,
        code,
        state
      );

      if (result.success) {
        setStatus("success");
      } else {
        setError(result.error || "Failed to complete connection.");
        setStatus("error");
      }
    }
    handleCallback();
  }, [orgId, provider, searchParams, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-zinc-950">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
          <p className="mt-3 text-sm text-stone-600 dark:text-zinc-400">
            Connecting {providerName}…
          </p>
        </div>
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
              {providerName} Connected
            </h1>
            <p className="mt-2 text-sm text-stone-600 dark:text-zinc-400">
              Your {providerName} account is linked. You can now publish listings
              and sync orders.
            </p>
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/organizations/${orgId}/settings/connections/listings`
                )
              }
              className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-indigo-700"
            >
              Go to Listing Connections
            </button>
          </>
        ) : (
          <>
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-stone-400 dark:text-zinc-500" />
            <h1 className="text-2xl font-bold text-stone-900 dark:text-white">
              Connection Failed
            </h1>
            <p className="mt-2 text-sm text-stone-600 dark:text-zinc-400">
              {error}
            </p>
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/organizations/${orgId}/settings/connections/listings`
                )
              }
              className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-indigo-700"
            >
              Back to Settings
            </button>
          </>
        )}
      </div>
    </div>
  );
}
