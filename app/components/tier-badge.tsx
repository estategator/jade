import { type SubscriptionTier } from "@/lib/tiers";

type TierBadgeProps = Readonly<{
  tier: SubscriptionTier;
  size?: "sm" | "md";
}>;

export function TierBadge({ tier, size = "sm" }: TierBadgeProps) {
  if (tier === "enterprise") return null;

  const sizeClasses =
    size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs";

  if (tier === "pro") {
    return (
      <span
        className={`inline-flex items-center rounded-full font-semibold leading-none ${sizeClasses} bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400`}
      >
        Pro
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold leading-none ${sizeClasses} bg-stone-100 text-stone-600 dark:bg-zinc-800 dark:text-zinc-400`}
    >
      Free
    </span>
  );
}
