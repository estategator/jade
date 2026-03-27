import { redirect } from "next/navigation";

/**
 * /organizations/[id]/settings/connections redirects to the financials sub-section.
 */
export default async function ConnectionsPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id: orgId } = await params;
  redirect(`/organizations/${orgId}/settings/connections/financials`);
}
