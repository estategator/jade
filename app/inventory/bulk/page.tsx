import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolveActiveOrgId } from "@/lib/rbac";
import { getUserProjects } from "@/app/inventory/actions";
import { BulkAddForm } from "@/app/inventory/_components/bulk-add-form";

export const dynamic = "force-dynamic";

export default async function BulkAddPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const activeOrgId = await resolveActiveOrgId(user.id);

  const projResult = await getUserProjects(user.id, activeOrgId);
  const projects = projResult.data ?? [];

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <BulkAddForm key={activeOrgId} projects={projects} userId={user.id} />
    </div>
  );
}
