"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, Zap, Building2 } from "lucide-react";
import { TIERS, type SubscriptionTier } from "@/lib/tiers";
import { createSubscriptionCheckoutSession, createBillingPortalSession } from "@/app/organizations/actions";

type UpgradeCtaProps = Readonly<{
  orgId: string;
  userId: string;
  currentTier: SubscriptionTier;
}>;

export function UpgradeCta({ orgId, userId, currentTier }: UpgradeCtaProps) {
  const [loadingTier, setLoadingTier] = useState<"pro" | "enterprise" | null>(null);
  const [error, setError] = useState("");

  const pro = TIERS.pro;
  const enterprise = TIERS.enterprise;

  const isCurrent = (tier: SubscriptionTier) => currentTier === tier;
  const isEnterprise = currentTier === "enterprise";

  async function handleUpgrade(tier: "pro" | "enterprise") {
    if (isCurrent(tier)) return;
    if (tier === "enterprise") {
      // Enterprise is sales-led — open contact form / mailto
      window.location.href = "mailto:sales@estategator.com?subject=Enterprise%20Plan%20Inquiry";
      return;
    }
    setLoadingTier(tier);
    setError("");

    try {
      const result = await createSubscriptionCheckoutSession(orgId, "pro", userId);
      if (result.error) {
        setError(result.error);
        setLoadingTier(null);
        return;
      }
      if (result.url) {
        window.location.href = result.url;
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoadingTier(null);
    }
  }

  async function handleManageBilling() {
    setError("");
    try {
      const result = await createBillingPortalSession(orgId, userId);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.url) {
        window.location.href = result.url;
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400"
        >
          {error}
        </motion.p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Pro Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className={`relative rounded-2xl border p-6 transition-all ${
            isCurrent("pro")
              ? "border-indigo-500 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-zinc-950 bg-white dark:bg-zinc-900 shadow-lg"
              : isEnterprise
              ? "border-stone-200 bg-stone-50 opacity-60 dark:border-zinc-700 dark:bg-zinc-900/30"
              : "border-stone-200 bg-white hover:border-indigo-200 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
          }`}
        >
          {pro.popular && !isCurrent("pro") && !isEnterprise && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-full">
              Most Popular
            </div>
          )}
          {isCurrent("pro") && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-full">
              Current Plan
            </div>
          )}

          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/20">
              <Zap className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-stone-900 dark:text-white">
                {pro.name}
              </h3>
              <p className="text-sm text-stone-500 dark:text-zinc-400">
                {pro.description}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <div className="text-3xl font-bold text-stone-900 dark:text-white">
              ${pro.price}
            </div>
            <p className="text-sm text-stone-500 dark:text-zinc-400">
              per month, billed monthly
            </p>
          </div>

          <div className="space-y-2.5 mb-6">
            {pro.features
              .filter((f) => f.included)
              .map((feature) => (
                <div key={feature.label} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="text-sm text-stone-700 dark:text-zinc-300">
                    {feature.label}
                  </span>
                </div>
              ))}
          </div>

          <button
            type="button"
            disabled={isEnterprise || loadingTier !== null}
            onClick={() => isCurrent("pro") ? handleManageBilling() : handleUpgrade("pro")}
            className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingTier === "pro" ? (
              <span className="inline-flex items-center gap-2 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                Redirecting to checkout…
              </span>
            ) : isCurrent("pro") ? (
              "Manage billing"
            ) : isEnterprise ? (
              "Downgrade unavailable"
            ) : (
              "Upgrade to Pro"
            )}
          </button>
        </motion.div>

        {/* Enterprise Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className={`relative rounded-2xl border p-6 transition-all ${
            isCurrent("enterprise")
              ? "border-indigo-500 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-zinc-950 bg-white dark:bg-zinc-900 shadow-lg"
              : "border-stone-200 bg-white hover:border-indigo-200 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
          }`}
        >
          {isCurrent("enterprise") && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-full">
              Current Plan
            </div>
          )}

          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-900/20">
              <Building2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-stone-900 dark:text-white">
                {enterprise.name}
              </h3>
              <p className="text-sm text-stone-500 dark:text-zinc-400">
                {enterprise.description}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <div className="text-3xl font-bold text-stone-900 dark:text-white">
              Custom
            </div>
            <p className="text-sm text-stone-500 dark:text-zinc-400">
              Contact sales for pricing
            </p>
          </div>

          <div className="space-y-2.5 mb-6">
            {enterprise.features
              .filter((f) => f.included)
              .slice(0, 6)
              .map((feature) => (
                <div key={feature.label} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="text-sm text-stone-700 dark:text-zinc-300">
                    {feature.label}
                  </span>
                </div>
              ))}
          </div>

          <button
            type="button"
            disabled={isCurrent("enterprise")}
            onClick={() => handleUpgrade("enterprise")}
            className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 border border-stone-300 text-stone-900 hover:bg-stone-50 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCurrent("enterprise") ? (
              "Current Plan"
            ) : (
              "Contact Sales"
            )}
          </button>
        </motion.div>
      </div>

      <p className="mt-6 text-center text-xs text-stone-400 dark:text-zinc-600">
        Cancel anytime from the billing portal. Upgrades take effect immediately.
      </p>
    </div>
  );
}
