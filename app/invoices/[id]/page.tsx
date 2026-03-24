import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getInvoiceDetail } from "@/app/invoices/actions";
import { InvoiceDetailClient } from "@/app/invoices/_components/invoice-detail-client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const result = await getInvoiceDetail(user.id, id);

  if (result.error || !result.data) {
    redirect("/invoices");
  }

  return <InvoiceDetailClient invoice={result.data} userId={user.id} />;
}
