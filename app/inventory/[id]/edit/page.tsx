import { redirect, notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolveActiveOrgId } from "@/lib/rbac";
import {
  getInventoryItem,
  getUserProjects,
} from "@/app/inventory/actions";
import { EditItemForm } from "@/app/inventory/_components/edit-item-form";
import { DirectionalTransition } from "@/app/components/directional-transition";

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
  const activeOrgId = await resolveActiveOrgId(user.id);

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
    <DirectionalTransition>
      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <EditItemForm key={activeOrgId} item={result.data} projects={projects} userId={user.id} />
      </div>
    </DirectionalTransition>
  );
}
