import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolveActiveOrgId } from "@/lib/rbac";
import { getInventoryItems } from "@/app/inventory/actions";
import { InventoryList } from "@/app/inventory/_components/inventory-list";

export const dynamic = "force-dynamic";

export default async function InventoryListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const activeOrgId = await resolveActiveOrgId(user.id);

  const result = await getInventoryItems(user.id, activeOrgId);
  const items = result.data ?? [];

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <InventoryList key={activeOrgId} initialItems={items} userId={user.id} />
    </div>
  );
}
