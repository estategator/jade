import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getOrganization } from "@/app/organizations/actions";
import { getOrgRole } from "@/lib/rbac";
import { getListingProviderConnections } from "@/app/organizations/listing-provider-actions";
import { ListingConnections } from "../../_components/listing-connections";

export default async function ConnectionsListingsPage({
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

  const [orgResult, role, listingResult] = await Promise.all([
    getOrganization(orgId),
    getOrgRole(orgId, user.id),
    getListingProviderConnections(orgId),
  ]);

  if (orgResult.error || !orgResult.data) redirect("/organizations");

  const isSuperadmin = role === "superadmin";

  return (
    <ListingConnections
      orgId={orgId}
      canManageConnections={isSuperadmin}
      initialStatuses={listingResult.data ?? []}
    />
  );
}
