"use client";

import { motion } from "framer-motion";
import { PiCheckCircleDuotone, PiXCircleDuotone } from "react-icons/pi";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { PricingTier } from "@/lib/tiers";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type PricingCardProps = Readonly<{
  tier: PricingTier;
  isPopular?: boolean;
  onSelectTier?: (tierId: string) => void;
}>;

export function PricingCard({ tier, isPopular = false, onSelectTier }: PricingCardProps) {
  const handleCTA = () => {
    if (onSelectTier) {
      onSelectTier(tier.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className={cn(
        "relative rounded-2xl border p-6 sm:p-8 transition-all duration-300",
        isPopular
          ? "border-indigo-500 bg-white dark:bg-zinc-900 shadow-lg ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-zinc-950"
          : "border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50"
      )}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-full">
          Most Popular
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-stone-900 dark:text-white mb-2">
          {tier.name}
        </h3>
        <p className="text-sm text-stone-600 dark:text-zinc-400 mb-4">
          {tier.description}
        </p>

        {/* Price */}
        <div className="mb-4">
          {tier.price === 0 ? (
            <>
              {tier.id === 'enterprise' ? (
                <>
                  <div className="text-3xl font-bold text-stone-900 dark:text-white">
                    Custom
                  </div>
                  <p className="text-sm text-stone-600 dark:text-zinc-400">
                    Contact sales for pricing
                  </p>
                </>
              ) : (
                <>
                  <div className="text-3xl font-bold text-stone-900 dark:text-white">
                    Free
                  </div>
                  <p className="text-sm text-stone-600 dark:text-zinc-400">
                    Forever free
                  </p>
                </>
              )}
            </>
          ) : (
            <>
              <div className="text-3xl font-bold text-stone-900 dark:text-white">
                ${tier.price}
              </div>
              <p className="text-sm text-stone-600 dark:text-zinc-400">
                per month, billed monthly
              </p>
            </>
          )}
        </div>

        {/* Member limit badge */}
        {tier.memberLimit !== Infinity ? (
          <div className="inline-block px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-6">
            Up to {tier.memberLimit} team member{tier.memberLimit > 1 ? 's' : ''}
          </div>
        ) : (
          <div className="inline-block px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-6">
            Unlimited team members
          </div>
        )}
      </div>

      {/* CTA Button */}
      <button
        onClick={handleCTA}
        className={cn(
          "w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 mb-6",
          isPopular
            ? "bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-500 shadow-md hover:shadow-lg"
            : "border border-stone-300 text-stone-900 hover:bg-stone-50 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800/50 focus-visible:ring-indigo-500"
        )}
      >
        {tier.id === 'free' ? 'Get Started' : 'Choose Plan'}
      </button>

      {/* Features */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-stone-600 dark:text-zinc-400 uppercase tracking-wide mb-4">
          Features
        </p>
        {tier.features.map((feature, index) => (
          <div key={index} className="flex items-start gap-3">
            {feature.included ? (
              <PiCheckCircleDuotone className="h-5 w-5 text-emerald-600 dark:text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <PiXCircleDuotone className="h-5 w-5 text-stone-300 dark:text-zinc-700 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  feature.included
                    ? "text-stone-900 dark:text-white"
                    : "text-stone-400 dark:text-zinc-500"
                )}
              >
                {feature.label}
              </p>
              {feature.description && (
                <p className="text-xs text-stone-500 dark:text-zinc-500 mt-0.5">
                  {feature.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
