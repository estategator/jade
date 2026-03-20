import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
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

  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get("curator_active_org")?.value ?? null;

  const result = await getInventoryItems(user.id, activeOrgId);
  const items = result.data ?? [];

  return (
    <>
      <InventoryList key={activeOrgId} initialItems={items} userId={user.id} />
    </>
  );
}
