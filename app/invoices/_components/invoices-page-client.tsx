"use client";

import { useState } from "react";
import { PageHeader } from "@/app/components/page-header";
import { InvoiceGenerateForm } from "@/app/invoices/_components/invoice-generate-form";
import { InvoiceList } from "@/app/invoices/_components/invoice-list";
import type { InvoiceListItem } from "@/app/invoices/actions";

type Props = {
  userId: string;
  orgId: string;
  initialInvoices: InvoiceListItem[];
  initialHasMore: boolean;
  initialProjects: { id: string; name: string }[];
  initialCategories: string[];
};

export function InvoicesPageClient({
  userId,
  orgId,
  initialInvoices,
  initialHasMore,
  initialProjects,
  initialCategories,
}: Props) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main className="px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        title="Invoices"
        description="Generate and manage invoices from your sales data."
      />

      <div className="space-y-8">
        <InvoiceGenerateForm
          userId={userId}
          orgId={orgId}
          initialProjects={initialProjects}
          initialCategories={initialCategories}
          onGenerated={() => setRefreshKey((k) => k + 1)}
        />

        <InvoiceList
          userId={userId}
          orgId={orgId}
          initialInvoices={initialInvoices}
          initialHasMore={initialHasMore}
          refreshKey={refreshKey}
        />
      </div>
    </main>
  );
}
