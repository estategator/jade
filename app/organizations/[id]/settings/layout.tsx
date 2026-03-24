import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  getOrganization,
  getPermissionsForOrg,
  getStripeAccountStatus,
} from "@/app/organizations/actions";
import { PageHeader } from "@/app/components/page-header";
import { OrgSettingsNav } from "./_components/org-settings-nav";
import { StripeOnboardingBanner } from "./_components/stripe-onboarding-banner";

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

  const [orgResult, permsResult, stripeResult] = await Promise.all([
    getOrganization(orgId),
    getPermissionsForOrg(orgId, user.id),
    getStripeAccountStatus(orgId),
  ]);

  if (orgResult.error || !orgResult.data) {
    redirect("/organizations");
  }

  const showOnboardingBanner =
    stripeResult.data?.connected === true &&
    stripeResult.data?.onboardingComplete === false;

  const canManageBilling = permsResult.includes("billing:manage");

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title="Settings"
        description={orgResult.data.name}
      />
      {showOnboardingBanner && (
        <div className="mt-4">
          <StripeOnboardingBanner
            orgId={orgId}
            canManageBilling={canManageBilling}
          />
        </div>
      )}
      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <OrgSettingsNav orgId={orgId} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
