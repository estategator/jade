import { redirect, notFound } from "next/navigation";

import { PageHeader } from "@/app/components/page-header";
import { ClientWizard } from "@/app/clients/_components/client-wizard";
import { getClientDetail } from "@/app/onboarding/actions";
import { resolveActiveOrgId } from "@/lib/rbac";
import { createClient } from "@/utils/supabase/server";

export default async function ClientDetailPage({
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

  const activeOrgId = await resolveActiveOrgId(user.id);
  if (!activeOrgId) {
    redirect("/organizations");
  }

  const result = await getClientDetail(id, user.id, activeOrgId);

  if (result.error) {
    if (result.error === "Client not found.") {
      notFound();
    }
    return (
      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
          {result.error}
        </div>
      </div>
    );
  }

  if (!result.data) {
    notFound();
  }

  const { client, projects, assignments } = result.data;

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title={client.full_name}
        description={client.email}
      />
      <ClientWizard
        client={client}
        projects={projects}
        assignments={assignments}
      />
    </div>
  );
}
