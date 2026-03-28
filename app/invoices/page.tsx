import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolveActiveOrgId } from "@/lib/rbac";
import { getInvoices, getOrgProjects, getOrgCategories } from "@/app/invoices/actions";
import { PageHeader } from "@/app/components/page-header";
import { InvoiceGenerateForm } from "@/app/invoices/_components/invoice-generate-form";
import { InvoiceList } from "@/app/invoices/_components/invoice-list";

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
    <main className="px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        title="Invoices"
        description="Generate and manage invoices from your sales data."
      />

      <div className="space-y-8">
        <InvoiceGenerateForm
          userId={user.id}
          orgId={activeOrgId}
          initialProjects={projectsResult.data ?? []}
          initialCategories={categoriesResult.data ?? []}
        />

        <InvoiceList
          userId={user.id}
          orgId={activeOrgId}
          initialInvoices={invoicesResult.data ?? []}
          initialHasMore={invoicesResult.hasMore ?? false}
        />
      </div>
    </main>
  );
}
