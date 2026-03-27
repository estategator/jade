import { redirect } from "next/navigation";

/**
 * Legacy route — redirects to the new Connections > Financials path.
 */
export default async function OrgSettingsFinancialConnectionsPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id: orgId } = await params;
  redirect(`/organizations/${orgId}/settings/connections/financials`);
}
