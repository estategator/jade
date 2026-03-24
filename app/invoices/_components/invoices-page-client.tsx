"use client";

import { useState } from "react";
import { PageHeader } from "@/app/components/page-header";
import { InvoiceGenerateForm } from "@/app/invoices/_components/invoice-generate-form";
import { InvoiceList } from "@/app/invoices/_components/invoice-list";

type Props = {
  userId: string;
  orgId: string;
};

export function InvoicesPageClient({ userId, orgId }: Props) {
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
          onGenerated={() => setRefreshKey((k) => k + 1)}
        />

        <InvoiceList
          userId={userId}
          orgId={orgId}
          refreshKey={refreshKey}
        />
      </div>
    </main>
  );
}
