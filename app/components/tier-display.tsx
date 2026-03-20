"use client";

import { motion } from "framer-motion";
import { Zap, Users, Crown } from "lucide-react";
import { TIERS, getMemberLimit } from "@/lib/tiers";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type TierDisplayProps = Readonly<{
  currentTier: 'free' | 'pro' | 'enterprise';
  memberCount: number;
  onUpgrade?: (tier: 'pro' | 'enterprise') => void;
  isLoading?: boolean;
}>;

export function TierDisplay({ currentTier, memberCount, onUpgrade, isLoading = false }: TierDisplayProps) {
  const tier = TIERS[currentTier];
  const memberLimit = getMemberLimit(currentTier);
  const isUnlimited = memberLimit === Infinity;
  const memberUsagePercent = isUnlimited ? 0 : (memberCount / memberLimit) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6"
    >
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-lg flex items-center justify-center",
            currentTier === 'free' && "bg-stone-100 dark:bg-zinc-800",
            currentTier === 'pro' && "bg-indigo-100 dark:bg-indigo-900/20",
            currentTier === 'enterprise' && "bg-purple-100 dark:bg-purple-900/20"
          )}>
            {currentTier === 'enterprise' ? (
              <Crown className={cn(
                "w-6 h-6",
                currentTier === 'enterprise' && "text-purple-600 dark:text-purple-400"
              )} />
            ) : currentTier === 'pro' ? (
              <Zap className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            ) : (
              <Users className="w-6 h-6 text-stone-600 dark:text-zinc-400" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white">
              {tier.name} Plan
            </h3>
            <p className="text-sm text-stone-600 dark:text-zinc-400">
              {tier.description}
            </p>
          </div>
        </div>
      </div>

      {/* Member Usage */}
      <div className="mb-6 p-4 bg-stone-50 dark:bg-zinc-800/50 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium text-stone-900 dark:text-white">
            Team Members
          </p>
          <p className="text-sm font-semibold text-stone-900 dark:text-white">
            {memberCount} {isUnlimited ? '(Unlimited)' : `of ${memberLimit}`}
          </p>
        </div>
        {!isUnlimited && (
          <div className="w-full bg-stone-200 dark:bg-zinc-700 rounded-full h-2 overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300 rounded-full",
                memberUsagePercent < 75 ? "bg-emerald-500" :
                memberUsagePercent < 100 ? "bg-yellow-500" :
                "bg-red-500"
              )}
              style={{ width: `${Math.min(memberUsagePercent, 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Features */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-stone-600 dark:text-zinc-400 uppercase tracking-wide mb-3">
          Included Features
        </p>
        <ul className="space-y-2">
          {tier.features
            .filter(f => f.included)
            .slice(0, 4)
            .map((feature, idx) => (
              <li key={idx} className="text-sm text-stone-700 dark:text-zinc-300 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                {feature.label}
              </li>
            ))}
        </ul>
      </div>

      {/* Upgrade CTA */}
      {currentTier !== 'enterprise' && (
        <div className="flex gap-3">
          {currentTier === 'free' && (
            <button
              onClick={() => onUpgrade?.('pro')}
              disabled={isLoading}
              className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
            >
              {isLoading ? 'Upgrading...' : 'Upgrade to Pro'}
            </button>
          )}
          {currentTier === 'pro' && (
            <button
              onClick={() => onUpgrade?.('enterprise')}
              disabled={isLoading}
              className="flex-1 py-2 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
            >
              {isLoading ? 'Contacting...' : 'Contact for Enterprise'}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
