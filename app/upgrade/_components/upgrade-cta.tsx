"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  PiCheckCircleDuotone,
  PiSpinnerDuotone,
  PiLightningDuotone,
  PiBuildingsDuotone,
  PiTagDuotone,
} from "react-icons/pi";
import { TIERS, type SubscriptionTier } from "@/lib/tiers";
import { createSubscriptionCheckoutSession, createBillingPortalSession } from "@/app/organizations/actions";
import { validateDiscountCode } from "@/app/discounts/actions";

type UpgradeCtaProps = Readonly<{
  orgId: string;
  userId: string;
  currentTier: SubscriptionTier;
}>;

export function UpgradeCta({ orgId, userId, currentTier }: UpgradeCtaProps) {
  const [loadingTier, setLoadingTier] = useState<"pro" | "enterprise" | null>(null);
  const [error, setError] = useState("");

  // Discount code state
  const [discountInput, setDiscountInput] = useState("");
  const [discountCodeId, setDiscountCodeId] = useState<string | null>(null);
  const [discountInfo, setDiscountInfo] = useState<{ percentOff: number; durationMonths: number } | null>(null);
  const [discountValidating, setDiscountValidating] = useState(false);
  const [discountError, setDiscountError] = useState("");

  const pro = TIERS.pro;
  const enterprise = TIERS.enterprise;

  const isCurrent = (tier: SubscriptionTier) => currentTier === tier;
  const isEnterprise = currentTier === "enterprise";

  async function handleApplyDiscount() {
    if (!discountInput.trim()) return;
    setDiscountValidating(true);
    setDiscountError("");
    setDiscountCodeId(null);
    setDiscountInfo(null);

    const result = await validateDiscountCode(userId, discountInput);
    setDiscountValidating(false);

    if (result.error) {
      setDiscountError(result.error);
      return;
    }
    if (result.valid && result.discountCodeId) {
      setDiscountCodeId(result.discountCodeId);
      setDiscountInfo({
        percentOff: result.percentOff!,
        durationMonths: result.durationMonths!,
      });
    }
  }

  async function handleUpgrade(tier: "pro" | "enterprise") {
    if (isCurrent(tier)) return;
    if (tier === "enterprise") {
      window.location.href = "mailto:sales@inventorytools.app?subject=Enterprise%20Plan%20Inquiry";
      return;
    }
    setLoadingTier(tier);
    setError("");

    try {
      const result = await createSubscriptionCheckoutSession(orgId, "pro", userId, discountCodeId ?? undefined);
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
    <div className="space-y-8">
      {/* Error alert */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400"
        >
          {error}
        </motion.p>
      )}

      {/* Discount code section */}
      {currentTier === "free" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-center gap-2.5 mb-3">
            <PiTagDuotone className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            <span className="text-sm font-semibold text-stone-900 dark:text-white">
              Have a discount code?
            </span>
          </div>
          <p className="text-xs text-stone-500 dark:text-zinc-500 mb-4">
            Enter your code below and the discount will be applied at checkout.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
              placeholder="DISC-XXXXXXXX"
              disabled={!!discountCodeId}
              className="flex-1 rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-mono text-stone-900 placeholder:text-stone-400 focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
            />
            {!discountCodeId ? (
              <button
                type="button"
                disabled={discountValidating || !discountInput.trim()}
                onClick={handleApplyDiscount}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {discountValidating ? (
                  <PiSpinnerDuotone className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  "Apply"
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDiscountCodeId(null);
                  setDiscountInfo(null);
                  setDiscountInput("");
                }}
                className="rounded-lg border border-stone-200 px-5 py-2.5 text-sm font-medium text-stone-700 transition-all hover:bg-stone-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Remove
              </button>
            )}
          </div>
          {discountError && (
            <p className="mt-3 text-xs text-red-600 dark:text-red-400">{discountError}</p>
          )}
          {discountInfo && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400"
            >
              {discountInfo.percentOff}% off for {discountInfo.durationMonths}{" "}
              {discountInfo.durationMonths === 1 ? "month" : "months"} will be applied at checkout.
            </motion.p>
          )}
        </motion.div>
      )}

      {/* Plan cards */}
      <div className="grid gap-8 sm:grid-cols-2">
        {/* Pro Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className={`relative flex flex-col rounded-2xl border p-6 sm:p-8 transition-all ${
            isCurrent("pro")
              ? "border-indigo-500 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-zinc-950 bg-white dark:bg-zinc-900 shadow-lg"
              : isEnterprise
              ? "border-stone-200 bg-stone-50 opacity-60 dark:border-zinc-700 dark:bg-zinc-900/30"
              : "border-stone-200 bg-white hover:border-indigo-200 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
          }`}
        >
          {pro.popular && !isCurrent("pro") && !isEnterprise && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-full shadow-sm">
              Most Popular
            </div>
          )}
          {isCurrent("pro") && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-full shadow-sm">
              Current Plan
            </div>
          )}

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/20">
              <PiLightningDuotone className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
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

          {/* Price */}
          <div className="mb-8">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-stone-900 dark:text-white">
                ${pro.price}
              </span>
              <span className="text-sm text-stone-500 dark:text-zinc-500">
                /month
              </span>
            </div>
            <p className="mt-1 text-xs text-stone-500 dark:text-zinc-500">
              Billed monthly
            </p>
          </div>

          {/* Features */}
          <div className="mb-8 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-500 mb-4">
              What&apos;s included
            </p>
            <div className="space-y-3">
              {pro.features
                .filter((f) => f.included)
                .map((feature) => (
                  <div key={feature.label} className="flex items-start gap-2.5">
                    <PiCheckCircleDuotone className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" aria-hidden="true" />
                    <span className="text-sm text-stone-700 dark:text-zinc-300">
                      {feature.label}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* CTA */}
          <button
            type="button"
            disabled={isEnterprise || loadingTier !== null}
            onClick={() => isCurrent("pro") ? handleManageBilling() : handleUpgrade("pro")}
            className="w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingTier === "pro" ? (
              <span className="inline-flex items-center gap-2 justify-center">
                <PiSpinnerDuotone className="h-4 w-4 animate-spin" aria-hidden="true" />
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
          transition={{ duration: 0.4, delay: 0.08 }}
          className={`relative flex flex-col rounded-2xl border p-6 sm:p-8 transition-all ${
            isCurrent("enterprise")
              ? "border-indigo-500 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-zinc-950 bg-white dark:bg-zinc-900 shadow-lg"
              : "border-stone-200 bg-white hover:border-indigo-200 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
          }`}
        >
          {isCurrent("enterprise") && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-full shadow-sm">
              Current Plan
            </div>
          )}

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-900/20">
              <PiBuildingsDuotone className="h-5 w-5 text-violet-600 dark:text-violet-400" aria-hidden="true" />
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

          {/* Price */}
          <div className="mb-8">
            <div className="text-4xl font-bold text-stone-900 dark:text-white">
              Custom
            </div>
            <p className="mt-1 text-xs text-stone-500 dark:text-zinc-500">
              Contact sales for tailored pricing
            </p>
          </div>

          {/* Features */}
          <div className="mb-8 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-500 mb-4">
              Everything in Pro, plus
            </p>
            <div className="space-y-3">
              {enterprise.features
                .filter((f) => f.included)
                .map((feature) => (
                  <div key={feature.label} className="flex items-start gap-2.5">
                    <PiCheckCircleDuotone className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" aria-hidden="true" />
                    <span className="text-sm text-stone-700 dark:text-zinc-300">
                      {feature.label}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* CTA */}
          <button
            type="button"
            disabled={isCurrent("enterprise")}
            onClick={() => handleUpgrade("enterprise")}
            className="w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 border border-stone-300 text-stone-900 hover:bg-stone-50 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCurrent("enterprise") ? "Current Plan" : "Contact Sales"}
          </button>
        </motion.div>
      </div>

      {/* Footer note */}
      <p className="text-center text-xs text-stone-400 dark:text-zinc-600">
        Cancel anytime from the billing portal. Upgrades take effect immediately.
      </p>
    </div>
  );
}
