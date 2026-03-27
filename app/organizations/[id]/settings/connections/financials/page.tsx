import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getOrganization } from "@/app/organizations/actions";
import { getOrgRole } from "@/lib/rbac";
import { getProviderConnections } from "@/app/organizations/provider-actions";
import { FinancialConnections } from "../../_components/financial-connections";

export default async function ConnectionsFinancialsPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id: orgId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [orgResult, role, providersResult] = await Promise.all([
    getOrganization(orgId),
    getOrgRole(orgId, user.id),
    getProviderConnections(orgId),
  ]);

  if (orgResult.error || !orgResult.data) redirect("/organizations");

  const isSuperadmin = role === "superadmin";

  return (
    <FinancialConnections
      orgId={orgId}
      canManageConnections={isSuperadmin}
      initialStatuses={providersResult.data ?? []}
    />
  );
}
