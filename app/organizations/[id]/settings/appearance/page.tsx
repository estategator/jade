import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  getOrganization,
  getPermissionsForOrg,
} from "@/app/organizations/actions";
import { getOrgSettings } from "@/app/settings/actions";
import { AppearanceForm } from "../_components/appearance-form";

export default async function OrgSettingsAppearancePage({
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

  const [orgResult, permsResult, orgSettingsResult] = await Promise.all([
    getOrganization(orgId),
    getPermissionsForOrg(orgId, user.id),
    getOrgSettings(orgId),
  ]);

  if (orgResult.error || !orgResult.data) redirect("/organizations");

  const canManageSettings = permsResult.includes("settings:manage");

  return (
    <AppearanceForm
      orgId={orgId}
      orgName={orgResult.data.name}
      canManageSettings={canManageSettings}
      initialSettings={orgSettingsResult.data?.settings ?? {}}
      initialEnforcedKeys={orgSettingsResult.data?.enforced_keys ?? []}
    />
  );
}
