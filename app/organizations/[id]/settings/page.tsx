import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  getOrganization,
  getPermissionsForOrg,
} from "@/app/organizations/actions";
import { GeneralForm } from "./_components/general-form";

export default async function OrgSettingsGeneralPage({
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

  return (
    <GeneralForm
      orgId={orgId}
      initialName={orgResult.data.name}
      initialCoverImageUrl={orgResult.data.cover_image_url}
      canManageSettings={canManageSettings}
    />
  );
}
