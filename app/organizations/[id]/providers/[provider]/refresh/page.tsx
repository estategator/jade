"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getOnboardingUrl } from "@/app/organizations/provider-actions";

export default function ProviderRefreshPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;
  const provider = params.provider as string;
  const [error, setError] = useState("");

  useEffect(() => {
    async function refresh() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      const result = await getOnboardingUrl(orgId, session.user.id, provider as "stripe" | "square" | "clover");
      if (result.url) {
        window.location.href = result.url;
      } else {
        setError(result.error || "Failed to generate onboarding link.");
      }
    }
    refresh();
  }, [orgId, provider, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-zinc-950">
        <div className="mx-4 w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-stone-400 dark:text-zinc-500" />
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => router.push(`/organizations/${orgId}/settings/connections/financials`)}
            className="mt-6 inline-flex items-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-indigo-700"
          >
            Back to Financial Connections
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-zinc-950">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
    </div>
  );
}
