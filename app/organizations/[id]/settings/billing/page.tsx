import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  getOrganization,
  getPermissionsForOrg,
  getStripeAccountStatus,
} from "@/app/organizations/actions";
import { BillingManager } from "../_components/billing-manager";

export default async function OrgSettingsBillingPage({
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

  const [orgResult, permsResult, stripeResult] = await Promise.all([
    getOrganization(orgId),
    getPermissionsForOrg(orgId, user.id),
    getStripeAccountStatus(orgId),
  ]);

  if (orgResult.error || !orgResult.data) redirect("/organizations");

  const canManageBilling = permsResult.includes("billing:manage");

  return (
    <BillingManager
      orgId={orgId}
      org={orgResult.data}
      canManageBilling={canManageBilling}
      initialStripeStatus={stripeResult.data ?? null}
    />
  );
}
