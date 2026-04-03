"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { PiSpinnerDuotone, PiShieldCheckDuotone, PiArrowsClockwiseDuotone, PiCreditCardDuotone } from "react-icons/pi";
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
        <PiSpinnerDuotone className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12 sm:mb-16 text-center"
        >
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 dark:text-white">
            Upgrade{org ? ` ${org.name}` : ""}
          </h1>
          <p className="mt-3 text-lg text-stone-600 dark:text-zinc-400 max-w-xl mx-auto">
            Unlock more powerful tools for your estate sales business. Upgrade
            anytime — downgrade or cancel whenever you need to.
          </p>
        </motion.div>

        {/* Plan selection */}
        {org && userId && (
          <UpgradeCta
            orgId={org.id}
            userId={userId}
            currentTier={(org.subscription_tier ?? "free") as SubscriptionTier}
          />
        )}

        {/* Reassurance strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center"
        >
          {[
            {
              icon: PiShieldCheckDuotone,
              label: "Secure checkout",
              detail: "Powered by Stripe with bank-level encryption",
            },
            {
              icon: PiArrowsClockwiseDuotone,
              label: "Change anytime",
              detail: "Switch plans or cancel from your billing settings",
            },
            {
              icon: PiCreditCardDuotone,
              label: "No hidden fees",
              detail: "Transparent pricing with no long-term contracts",
            },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/20">
                <item.icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-stone-900 dark:text-white">
                {item.label}
              </p>
              <p className="text-xs text-stone-500 dark:text-zinc-500">
                {item.detail}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
