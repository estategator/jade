"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getOrganization, type Organization } from "@/app/organizations/actions";
import { UpgradeCta } from "./_components/upgrade-cta";
import { type SubscriptionTier } from "@/lib/tiers";

export default function UpgradePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId");

  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<Organization | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        const redirectUrl = orgId ? `/upgrade?orgId=${orgId}` : "/upgrade";
        router.replace(`/login?next=${encodeURIComponent(redirectUrl)}`);
        return;
      }

      setUserId(session.user.id);

      if (!orgId) {
        router.replace("/dashboard");
        return;
      }

      const result = await getOrganization(orgId);
      if (result.error || !result.data) {
        router.replace("/organizations");
        return;
      }

      setOrg(result.data);
      setLoading(false);
    }

    load();
  }, [router, orgId]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-stone-900 dark:text-white">
          Upgrade{org ? ` ${org.name}` : ""}
        </h1>
        <p className="mt-2 text-stone-500 dark:text-zinc-400">
          Choose the plan that works best for your team
          </p>
        </div>

        {org && userId && (
          <UpgradeCta
            orgId={org.id}
            userId={userId}
            currentTier={(org.subscription_tier ?? "free") as SubscriptionTier}
          />
        )}
    </div>
  );
}
