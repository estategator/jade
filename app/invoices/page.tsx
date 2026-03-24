import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolveActiveOrgId } from "@/lib/rbac";
import { getInvoices, getOrgProjects, getOrgCategories } from "@/app/invoices/actions";
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

  // Pre-fetch data server-side for fast initial render
  const [invoicesResult, projectsResult, categoriesResult] = await Promise.all([
    getInvoices(user.id, activeOrgId),
    getOrgProjects(user.id, activeOrgId),
    getOrgCategories(user.id, activeOrgId),
  ]);

  return (
    <InvoicesPageClient
      userId={user.id}
      orgId={activeOrgId}
      initialInvoices={invoicesResult.data ?? []}
      initialHasMore={invoicesResult.hasMore ?? false}
      initialProjects={projectsResult.data ?? []}
      initialCategories={categoriesResult.data ?? []}
    />
  );
}
