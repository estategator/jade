"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Loader2,
  CreditCard,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/app/components/page-header";
import { OrgSettingsNav } from "../_components/org-settings-nav";
import { TierBadge } from "@/app/components/tier-badge";
import { TIERS, type SubscriptionTier } from "@/lib/tiers";
import {
  getOrganization,
  getPermissionsForOrg,
  createStripeConnectAccount,
  getStripeOnboardingLink,
  getStripeAccountStatus,
  createBillingPortalSession,
  type Organization,
  type SubscriptionStatus,
} from "@/app/organizations/actions";

export default function OrgSettingsBillingPage() {
  const router = useRouter();
  const params = useParams();
  const orgId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState("");
  const [org, setOrg] = useState<Organization | null>(null);
  const [canManageBilling, setCanManageBilling] = useState(false);
  const [error, setError] = useState("");
  const [stripeStatus, setStripeStatus] = useState<{
    connected: boolean;
    onboardingComplete: boolean;
    accountId: string | null;
  } | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      const [orgResult, permsResult, stripeResult] = await Promise.all([
        getOrganization(orgId),
        getPermissionsForOrg(orgId, session.user.id),
        getStripeAccountStatus(orgId),
      ]);

      if (orgResult.error || !orgResult.data) {
        router.replace("/organizations");
        return;
      }

      setOrg(orgResult.data);
      setOrgName(orgResult.data.name);
      setCanManageBilling(permsResult.includes("billing:manage"));
      if (stripeResult.data) setStripeStatus(stripeResult.data);
      setLoading(false);
    }
    init();
  }, [router, orgId]);

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Organization Settings"
        description={`Manage settings for ${orgName}.`}
      />
      <OrgSettingsNav orgId={orgId} />

      <p className="mt-6 text-sm text-stone-500 dark:text-zinc-400">
        Manage Stripe onboarding and your organization subscription.
      </p>

      {!canManageBilling && (
        <p className="mt-3 text-sm text-stone-500 dark:text-zinc-400">
          You can view billing status, but only billing managers can make
          changes.
        </p>
      )}

      {error && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400"
        >
          {error}
        </motion.p>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="mt-6 space-y-6"
      >
        <div className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                  Subscription Plan
                </h2>
                <TierBadge
                  tier={
                    (org?.subscription_tier ?? "free") as SubscriptionTier
                  }
                  size="md"
                />
              </div>
              <p className="text-sm text-stone-500 dark:text-zinc-500">
                Current billing tier and member limits
              </p>
            </div>
          </div>

          {(() => {
            const currentTier = (org?.subscription_tier ??
              "free") as SubscriptionTier;
            const tierData = TIERS[currentTier];
            const subStatus = (org?.subscription_status ??
              "none") as SubscriptionStatus;
            const cancelPending = org?.cancel_at_period_end ?? false;

            return (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-600 dark:text-zinc-400">
                  <span>
                    Plan:{" "}
                    <span className="font-medium text-stone-900 dark:text-white">
                      {tierData.name}
                    </span>
                  </span>
                  <span className="text-stone-300 dark:text-zinc-700">
                    ·
                  </span>
                  <span>
                    Team members: up to{" "}
                    <span className="font-medium text-stone-900 dark:text-white">
                      {tierData.memberLimit === Infinity
                        ? "unlimited"
                        : tierData.memberLimit}
                    </span>
                  </span>
                  {subStatus !== "none" && (
                    <>
                      <span className="text-stone-300 dark:text-zinc-700">
                        ·
                      </span>
                      <span>
                        Status:{" "}
                        <span
                          className={`font-medium ${
                            subStatus === "active"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : subStatus === "past_due"
                                ? "text-red-600 dark:text-red-400"
                                : "text-stone-900 dark:text-white"
                          }`}
                        >
                          {subStatus.replace("_", " ")}
                        </span>
                      </span>
                    </>
                  )}
                </div>

                {cancelPending && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Your subscription will cancel at the end of the current
                    billing period.
                  </p>
                )}

                {subStatus === "past_due" && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Your last payment failed. Please update your payment
                    method to keep your plan active.
                  </p>
                )}

                {canManageBilling && (
                  <div className="flex flex-wrap gap-3">
                    {currentTier === "free" && (
                      <Link
                        href={`/upgrade?orgId=${orgId}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-700"
                      >
                        <Sparkles className="h-4 w-4" />
                        Upgrade to Pro
                      </Link>
                    )}
                    {org?.stripe_customer_id && (
                      <button
                        type="button"
                        onClick={async () => {
                          const {
                            data: { session },
                          } = await supabase.auth.getSession();
                          if (!session) return;
                          const result = await createBillingPortalSession(
                            orgId,
                            session.user.id
                          );
                          if (result.url) window.location.href = result.url;
                          if (result.error) setError(result.error);
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-all hover:border-stone-300 hover:bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        <CreditCard className="h-4 w-4" />
                        Billing portal
                      </button>
                    )}
                  </div>
                )}

                {!canManageBilling && (
                  <p className="text-sm text-stone-500 dark:text-zinc-500">
                    Contact an organization billing manager to change plans.
                  </p>
                )}
              </div>
            );
          })()}
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                Stripe Connect
              </h2>
              <p className="text-sm text-stone-500 dark:text-zinc-500">
                Connect payouts for organization sales
              </p>
            </div>
          </div>

          {stripeStatus?.onboardingComplete ? (
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-900/20">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Stripe account connected
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Payouts are enabled for this organization.
                </p>
              </div>
              <a
                href="https://dashboard.stripe.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 transition-colors hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                Dashboard
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ) : stripeStatus?.connected ? (
            <div className="space-y-3">
              <p className="text-sm text-stone-600 dark:text-zinc-400">
                Stripe account exists, but onboarding is incomplete.
              </p>
              {canManageBilling && (
                <button
                  type="button"
                  onClick={handleConnectStripe}
                  disabled={stripeLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {stripeLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                  Continue setup
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-stone-600 dark:text-zinc-400">
                Connect Stripe to receive payouts when inventory sells.
              </p>
              {canManageBilling && (
                <button
                  type="button"
                  onClick={handleConnectStripe}
                  disabled={stripeLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {stripeLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  Connect Stripe account
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
