import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import {
  getInventoryItem,
  getUserProjects,
} from "@/app/inventory/actions";
import { EditItemForm } from "@/app/inventory/_components/edit-item-form";

export const dynamic = "force-dynamic";

export default async function EditInventoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get("curator_active_org")?.value ?? null;

  const [result, projResult] = await Promise.all([
    getInventoryItem(id, user.id),
    getUserProjects(user.id, activeOrgId),
  ]);

  if (!result.data) {
    notFound();
  }

  // Enforce active org boundary: if activeOrgId is set, the item must belong to that org
  if (activeOrgId && result.data.project?.org_id !== activeOrgId) {
    notFound();
  }

  const projects = projResult.data ?? [];

  return (
    <>
      <EditItemForm key={activeOrgId} item={result.data} projects={projects} userId={user.id} />
    </>
  );
}
