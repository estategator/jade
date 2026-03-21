import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getOrganization } from "@/app/organizations/actions";
import { PageHeader } from "@/app/components/page-header";
import { OrgSettingsNav } from "./_components/org-settings-nav";

export default async function OrgSettingsLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}>) {
  const { id: orgId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const orgResult = await getOrganization(orgId);

  if (orgResult.error || !orgResult.data) {
    redirect("/organizations");
  }

  return (
    <>
      <PageHeader
        title="Organization Settings"
        description={`Manage settings for ${orgResult.data.name}.`}
      />
      <OrgSettingsNav orgId={orgId} />
      <div className="mt-6">{children}</div>
    </>
  );
}
