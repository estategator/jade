import { redirect, notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getInventoryItem } from "@/app/inventory/actions";
import type { AIAnalysisResult } from "@/app/inventory/actions";
import { ThermalLabel } from "./thermal-label";

export const dynamic = "force-dynamic";

export default async function PrintLabelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const result = await getInventoryItem(id, user.id);

  if (result.error || !result.data) {
    notFound();
  }

  const item = result.data;
  const insights = item.ai_insights as AIAnalysisResult | null;

  // Mirror the "Great deal" logic from the public item page:
  // price <= AI-suggested price for the item's current condition
  const isGreatDeal =
    !!insights?.pricePerCondition &&
    !!item.condition &&
    item.price <=
      (insights.pricePerCondition as Record<string, number>)[
        item.condition.toLowerCase()
      ];

  return (
    <ThermalLabel
      itemName={item.name}
      itemPrice={item.price}
      itemDescription={item.description}
      itemId={item.id}
      isGreatDeal={isGreatDeal}
    />
  );
}
