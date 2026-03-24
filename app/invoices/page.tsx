import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolveActiveOrgId } from "@/lib/rbac";
import { InvoicesPageClient } from "@/app/invoices/_components/invoices-page-client";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const activeOrgId = await resolveActiveOrgId(user.id);

  if (!activeOrgId) {
    redirect("/organizations");
  }

  return <InvoicesPageClient userId={user.id} orgId={activeOrgId} />;
}
