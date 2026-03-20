import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getUserProjects } from "@/app/inventory/actions";
import { AddItemForm } from "@/app/inventory/_components/add-item-form";

export const dynamic = "force-dynamic";

export default async function AddInventoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get("curator_active_org")?.value ?? null;

  const projResult = await getUserProjects(user.id, activeOrgId);
  const projects = projResult.data ?? [];

  return (
    <>
      <AddItemForm key={activeOrgId} projects={projects} userId={user.id} />
    </>
  );
}
