import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  getOrganization,
  getPermissionsForOrg,
} from "@/app/organizations/actions";
import { AuditLogView } from "../_components/audit-log-view";

export default async function OrgSettingsAuditPage({
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

  const [orgResult, permsResult] = await Promise.all([
    getOrganization(orgId),
    getPermissionsForOrg(orgId, user.id),
  ]);

  if (orgResult.error || !orgResult.data) redirect("/organizations");

  const canView = permsResult.includes("settings:manage") || permsResult.includes("settings:view");

  return <AuditLogView orgId={orgId} canView={canView} />;
}
