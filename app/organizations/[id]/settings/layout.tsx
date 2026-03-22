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
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title="Settings"
        description={orgResult.data.name}
      />
      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <OrgSettingsNav orgId={orgId} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
