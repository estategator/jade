"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSettings } from "@/app/components/settings-provider";
import { UpgradeModal } from "@/app/components/upgrade-modal";
import { type SubscriptionTier } from "@/lib/tiers";

export function UpgradeIntentHandler() {
  const searchParams = useSearchParams();
  const { activeOrgId } = useSettings();

  const paramIntent = searchParams.get("intent");
  const paramTier = searchParams.get("tier");
  const validTier: SubscriptionTier | null =
    paramIntent === "upgrade" && (paramTier === "pro" || paramTier === "enterprise")
      ? (paramTier as SubscriptionTier)
      : null;

  // Initialize directly from URL to avoid setting state inside an effect
  const [isOpen, setIsOpen] = useState<boolean>(() => validTier !== null);
  const [recommendedTier, setRecommendedTier] = useState<SubscriptionTier>(
    () => validTier ?? "pro"
  );

  // Side-effect only: clean the URL so the modal doesn't re-open on refresh
  useEffect(() => {
    if (validTier !== null) {
      setRecommendedTier(validTier);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpgradeClick = (tier: SubscriptionTier) => {
    setIsOpen(false);
    const params = new URLSearchParams();
    if (activeOrgId) params.set("orgId", activeOrgId);
    params.set("tier", tier);
    window.location.href = `/upgrade?${params.toString()}`;
  };

  return (
    <UpgradeModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      currentTier="free"
      recommendedTier={recommendedTier}
      onUpgradeClick={handleUpgradeClick}
      isLoading={false}
    />
  );
}
