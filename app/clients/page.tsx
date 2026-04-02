import { redirect } from "next/navigation";

import { PageHeader } from "@/app/components/page-header";
import { ClientList } from "@/app/clients/_components/client-list";
import { getOnboardingDashboard, getFrequentBuyerSuggestions } from "@/app/onboarding/actions";
import { resolveActiveOrgId } from "@/lib/rbac";
import { createClient } from "@/utils/supabase/server";

export default async function ClientsPage() {
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

  const [result, suggestionsResult] = await Promise.all([
    getOnboardingDashboard(user.id, activeOrgId),
    getFrequentBuyerSuggestions(activeOrgId),
  ]);

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title="Clients"
        description="Manage client records, onboarding workflows, and project assignments."
      />

      {result.error || !result.data ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
          {result.error ?? "Failed to load clients."}
        </div>
      ) : (
        <ClientList
          initialData={result.data}
          suggestions={suggestionsResult.data ?? []}
        />
      )}
    </div>
  );
}
