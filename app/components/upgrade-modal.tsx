"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Zap } from "lucide-react";
import { TIERS, type SubscriptionTier } from "@/lib/tiers";

type UpgradeModalProps = Readonly<{
  isOpen: boolean;
  onClose: () => void;
  currentTier: SubscriptionTier;
  recommendedTier?: SubscriptionTier;
  onUpgradeClick?: (tier: SubscriptionTier) => void;
  isLoading?: boolean;
}>;

export function UpgradeModal({
  isOpen,
  onClose,
  currentTier,
  recommendedTier = "pro",
  onUpgradeClick,
  isLoading = false,
}: UpgradeModalProps) {
  const targetTier = recommendedTier !== currentTier ? recommendedTier : "pro";
  const tier = TIERS[targetTier];

  const handleUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick(targetTier);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3 }}
            className="relative w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:p-8"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header */}
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <Zap className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                  Unlock more with {tier.name}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-stone-900 dark:text-white">
                Ready to grow your business?
              </h2>
              <p className="mt-2 text-sm text-stone-600 dark:text-zinc-400">
                {tier.description}
              </p>
            </div>

            {/* Benefits */}
            <div className="mb-6 space-y-3">
              {tier.features
                .filter((f) => f.included)
                .slice(0, 3)
                .map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        ✓
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-stone-900 dark:text-white">
                        {feature.label}
                      </p>
                      {feature.description && (
                        <p className="text-xs text-stone-500 dark:text-zinc-500">
                          {feature.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>

            {/* Pricing */}
            <div className="mb-6 rounded-lg bg-stone-50 p-4 dark:bg-zinc-800/30">
              <p className="text-xs font-semibold text-stone-600 dark:text-zinc-400">
                PRICING
              </p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-stone-900 dark:text-white">
                  ${tier.price}
                </span>
                <span className="text-sm text-stone-600 dark:text-zinc-400">
                  /month, billed monthly
                </span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleUpgrade}
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-700"
              >
                {isLoading ? "Processing..." : `Upgrade to ${tier.name}`}
                {!isLoading && <ArrowRight className="h-4 w-4" />}
              </button>
              <button
                onClick={onClose}
                className="rounded-xl border border-stone-300 px-6 py-3 text-sm font-semibold text-stone-900 transition-all hover:bg-stone-50 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800/50"
              >
                Maybe later
              </button>
            </div>

            {/* Footer note */}
            <p className="mt-4 text-center text-xs text-stone-500 dark:text-zinc-500">
              Cancel anytime. No credit card required to start.
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
