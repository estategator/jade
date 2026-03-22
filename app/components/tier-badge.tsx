import { type SubscriptionTier } from "@/lib/tiers";

type TierBadgeProps = Readonly<{
  tier: SubscriptionTier;
  size?: "sm" | "md";
  variant?: "pill" | "text";
}>;

export function TierBadge({ tier, size = "sm", variant = "pill" }: TierBadgeProps) {
  if (tier === "enterprise") return null;

  const label = tier === "pro" ? "Pro" : "Free";
  const colorClasses =
    tier === "pro"
      ? "text-indigo-700 dark:text-indigo-400"
      : "text-stone-600 dark:text-zinc-400";

  if (variant === "text") {
    const textSize = size === "sm" ? "text-[10px]" : "text-xs";
    return (
      <span className={`font-semibold leading-none ${textSize} ${colorClasses}`}>
        {label}
      </span>
    );
  }

  const sizeClasses =
    size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs";
  const bgClasses =
    tier === "pro"
      ? "bg-indigo-100 dark:bg-indigo-900/30"
      : "bg-stone-100 dark:bg-zinc-800";

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold leading-none ${sizeClasses} ${bgClasses} ${colorClasses}`}
    >
      {label}
    </span>
  );
}
