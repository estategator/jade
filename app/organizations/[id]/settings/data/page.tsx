import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  getOrganization,
  getPermissionsForOrg,
} from "@/app/organizations/actions";
import { DataExportSettings } from "../_components/data-export-settings";

export default async function OrgSettingsDataPage({
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

  return <DataExportSettings orgId={orgId} canManageSettings={canManageSettings} />;
}
