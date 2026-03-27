"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CreditCard,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { TierBadge } from "@/app/components/tier-badge";
import { TIERS, type SubscriptionTier } from "@/lib/tiers";
import {
  createBillingPortalSession,
  type Organization,
  type SubscriptionStatus,
} from "@/app/organizations/actions";

type BillingManagerProps = Readonly<{
  orgId: string;
  org: Organization;
  canManageBilling: boolean;
}>;

export function BillingManager({
  orgId,
  org,
  canManageBilling,
}: BillingManagerProps) {
  const [error, setError] = useState("");
  const [success] = useState("");

  return (
    <>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400"
        >
          {error}
        </motion.p>
      )}

      {success && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-400"
        >
          {success}
        </motion.p>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-5"
      >
        {/* Subscription Plan */}
        <div className="rounded-xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3 dark:border-zinc-800/60">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-semibold text-stone-900 dark:text-white">Subscription</h2>
            </div>
            <TierBadge tier={(org.subscription_tier ?? "free") as SubscriptionTier} size="sm" />
          </div>
          <div className="px-5 py-4">
            {(() => {
              const currentTier = (org.subscription_tier ?? "free") as SubscriptionTier;
              const tierData = TIERS[currentTier];
              const subStatus = (org.subscription_status ?? "none") as SubscriptionStatus;
              const cancelPending = org.cancel_at_period_end ?? false;

              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-stone-500 dark:text-zinc-500">Plan</p>
                      <p className="font-medium text-stone-900 dark:text-white">{tierData.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-stone-500 dark:text-zinc-500">Members</p>
                      <p className="font-medium text-stone-900 dark:text-white">
                        {tierData.memberLimit === Infinity ? "Unlimited" : `Up to ${tierData.memberLimit}`}
                      </p>
                    </div>
                    {subStatus !== "none" && (
                      <div>
                        <p className="text-xs text-stone-500 dark:text-zinc-500">Status</p>
                        <p className={`font-medium ${
                          subStatus === "active" ? "text-emerald-600 dark:text-emerald-400"
                            : subStatus === "past_due" ? "text-red-600 dark:text-red-400"
                            : "text-stone-900 dark:text-white"
                        }`}>
                          {subStatus.replace("_", " ")}
                        </p>
                      </div>
                    )}
                  </div>

                  {cancelPending && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Cancels at end of current billing period.
                    </p>
                  )}
                  {subStatus === "past_due" && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Payment failed. Update your payment method to keep your plan.
                    </p>
                  )}

                  {canManageBilling && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {currentTier === "free" && (
                        <Link
                          href={`/upgrade?orgId=${orgId}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-indigo-700"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Upgrade to Pro
                        </Link>
                      )}
                      {org.stripe_customer_id && (
                        <button
                          type="button"
                          onClick={async () => {
                            const { data: { session } } = await supabase.auth.getSession();
                            if (!session) return;
                            const result = await createBillingPortalSession(orgId, session.user.id);
                            if (result.url) window.location.href = result.url;
                            if (result.error) setError(result.error);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 transition-all hover:border-stone-300 hover:bg-stone-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          Billing portal
                        </button>
                      )}
                    </div>
                  )}

                  {!canManageBilling && (
                    <p className="text-xs text-stone-500 dark:text-zinc-500">
                      Contact a billing manager to change plans.
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

      </motion.div>
    </>
  );
}
