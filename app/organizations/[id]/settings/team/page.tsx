import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  getOrganization,
  getPermissionsForOrg,
  getOrgMembers,
  getPendingInvitations,
  type MemberWithProfile,
  type OrgInvitation,
} from "@/app/organizations/actions";
import { TeamManager } from "../_components/team-manager";

export default async function OrgSettingsTeamPage({
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

  const [orgResult, permsResult, membersResult, pendingResult] =
    await Promise.all([
      getOrganization(orgId),
      getPermissionsForOrg(orgId, user.id),
      getOrgMembers(orgId),
      getPendingInvitations(orgId),
    ]);

  if (orgResult.error || !orgResult.data) redirect("/organizations");

  const canInviteMembers = permsResult.includes("members:invite");
  const canUpdateMembers = permsResult.includes("members:update_role");

  return (
    <TeamManager
      orgId={orgId}
      canInviteMembers={canInviteMembers}
      canUpdateMembers={canUpdateMembers}
      initialMembers={(membersResult.data ?? []) as MemberWithProfile[]}
      initialPendingInvitations={(pendingResult.data ?? []) as OrgInvitation[]}
    />
  );
}
