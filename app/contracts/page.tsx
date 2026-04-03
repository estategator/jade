import { redirect } from "next/navigation";

import { PageHeader } from "@/app/components/page-header";
import { ContractTable } from "@/app/contracts/_components/contract-table";
import { ContractTemplateTable } from "@/app/contracts/_components/contract-template-table";
import { getContractTemplates } from "@/app/contracts/actions";
import { getOrgContracts } from "@/app/onboarding/actions";
import { resolveActiveOrgId, hasPermission } from "@/lib/rbac";
import { createClient } from "@/utils/supabase/server";

import { ContractsPageTabs } from "@/app/contracts/_components/contracts-page-tabs";

export const dynamic = "force-dynamic";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
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

  const [contractsResult, templatesResult] = await Promise.all([
    getOrgContracts(user.id, activeOrgId),
    getContractTemplates(),
  ]);

  const canManageTemplates = await hasPermission(activeOrgId, user.id, 'onboarding:update');

  const activeTab = tab === "templates" ? "templates" : "contracts";

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title="Contracts"
        description="View and manage all client contracts and templates across your organization."
      />

      <ContractsPageTabs activeTab={activeTab} />

      {activeTab === "contracts" ? (
        contractsResult.error || !contractsResult.data ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
            {contractsResult.error ?? "Failed to load contracts."}
          </div>
        ) : (
          <ContractTable contracts={contractsResult.data.contracts} />
        )
      ) : (
        <ContractTemplateTable
          templates={templatesResult.data ?? []}
          error={templatesResult.error}
          canManageTemplates={canManageTemplates}
        />
      )}
    </div>
  );
}
