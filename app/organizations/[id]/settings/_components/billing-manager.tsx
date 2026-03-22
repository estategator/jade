"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Loader2,
  CreditCard,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { TierBadge } from "@/app/components/tier-badge";
import { TIERS, type SubscriptionTier } from "@/lib/tiers";
import {
  createStripeConnectAccount,
  getStripeOnboardingLink,
  getStripeAccountStatus,
  createBillingPortalSession,
  type Organization,
  type SubscriptionStatus,
} from "@/app/organizations/actions";

type StripeStatus = {
  connected: boolean;
  onboardingComplete: boolean;
  accountId: string | null;
};

type BillingManagerProps = Readonly<{
  orgId: string;
  org: Organization;
  canManageBilling: boolean;
  initialStripeStatus: StripeStatus | null;
}>;

export function BillingManager({
  orgId,
  org,
  canManageBilling,
  initialStripeStatus,
}: BillingManagerProps) {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(
    initialStripeStatus
  );
  const [stripeLoading, setStripeLoading] = useState(false);

  // Handle Stripe return intent
  useEffect(() => {
    const stripeReturn = searchParams.get("stripeReturn");
    if (stripeReturn === "true") {
      setSuccess("Stripe setup updated. Refreshing status...");
      getStripeAccountStatus(orgId).then((result) => {
        if (result.data) setStripeStatus(result.data);
        setSuccess("Stripe status refreshed successfully.");
      });
      // Clean the URL without triggering a navigation
      window.history.replaceState(
        {},
        "",
        `/organizations/${orgId}/settings/billing`
      );
    }
  }, [searchParams, orgId]);

  async function handleConnectStripe() {
    setStripeLoading(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Not authenticated.");
        setStripeLoading(false);
        return;
      }

      if (!stripeStatus?.connected) {
        const createResult = await createStripeConnectAccount(
          orgId,
          session.user.id
        );
        if (createResult.error) {
          setError(createResult.error);
          setStripeLoading(false);
          return;
        }
      }

      const linkResult = await getStripeOnboardingLink(
        orgId,
        session.user.id
      );
      if (linkResult.error) {
        setError(linkResult.error);
        setStripeLoading(false);
        return;
      }

      if (linkResult.url) {
        window.location.href = linkResult.url;
      }
    } catch {
      setError("Failed to start Stripe onboarding.");
      setStripeLoading(false);
    }
  }

  return (
    <>
      {!canManageBilling && (
        <p className="mb-3 text-xs text-stone-500 dark:text-zinc-400">
          You can view billing status, but only billing managers can make changes.
        </p>
      )}

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

        {/* Stripe Connect */}
        <div className="rounded-xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-stone-100 px-5 py-3 dark:border-zinc-800/60">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              <h2 className="text-sm font-semibold text-stone-900 dark:text-white">Stripe Connect</h2>
            </div>
            <p className="text-xs text-stone-500 dark:text-zinc-500">Receive payouts for sales</p>
          </div>
          <div className="px-5 py-4">
            {stripeStatus?.onboardingComplete ? (
              <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2.5 dark:bg-emerald-900/20">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Connected</p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400">Payouts enabled</p>
                  </div>
                </div>
                <a
                  href="https://dashboard.stripe.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  Dashboard <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ) : stripeStatus?.connected ? (
              <div className="space-y-2">
                <p className="text-sm text-stone-600 dark:text-zinc-400">Onboarding incomplete.</p>
                {canManageBilling && (
                  <button type="button" onClick={handleConnectStripe} disabled={stripeLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
                    {stripeLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                    Continue setup
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-stone-600 dark:text-zinc-400">Connect Stripe to receive payouts when inventory sells.</p>
                {canManageBilling && (
                  <button type="button" onClick={handleConnectStripe} disabled={stripeLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
                    {stripeLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                    Connect Stripe
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
