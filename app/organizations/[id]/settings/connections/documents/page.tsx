import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getOrganization } from "@/app/organizations/actions";
import { getOrgRole } from "@/lib/rbac";
import { getDocumentProviderConnections } from "@/app/organizations/document-provider-actions";
import { DocumentConnections } from "../../_components/document-connections";

export default async function ConnectionsDocumentsPage({
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

  const [orgResult, role, documentResult] = await Promise.all([
    getOrganization(orgId),
    getOrgRole(orgId, user.id),
    getDocumentProviderConnections(orgId),
  ]);

  if (orgResult.error || !orgResult.data) redirect("/organizations");

  const isSuperadmin = role === "superadmin";

  return (
    <DocumentConnections
      orgId={orgId}
      canManageConnections={isSuperadmin}
      initialStatuses={documentResult.data ?? []}
    />
  );
}
