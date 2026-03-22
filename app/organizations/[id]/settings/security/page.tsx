import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  getOrganization,
  getPermissionsForOrg,
} from "@/app/organizations/actions";
import { SecuritySettings } from "../_components/security-settings";

export default async function OrgSettingsSecurityPage({
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

  const canManageSettings = permsResult.includes("settings:manage");

  return <SecuritySettings orgId={orgId} canManageSettings={canManageSettings} />;
}
