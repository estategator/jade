"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  PiCheckCircleDuotone,
  PiClockDuotone,
  PiProhibitDuotone,
  PiSpinnerDuotone,
  PiSealCheckDuotone,
  PiTrashDuotone,
  PiPrinterDuotone,
} from "react-icons/pi";
import { PageHeader } from "@/app/components/page-header";
import {
  finalizeInvoice,
  voidInvoice,
  deleteInvoice,
  type InvoiceWithLines,
} from "@/app/invoices/actions";

const statusConfig = {
  draft: {
    label: "Draft",
    icon: PiClockDuotone,
    className: "bg-stone-100 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
  finalized: {
    label: "Finalized",
    icon: PiCheckCircleDuotone,
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  void: {
    label: "Void",
    icon: PiProhibitDuotone,
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
} as const;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type Props = {
  invoice: InvoiceWithLines;
  userId: string;
};

export function InvoiceDetailClient({ invoice: initialInvoice, userId }: Props) {
  const router = useRouter();
  const [invoice] = useState(initialInvoice);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const sc = statusConfig[invoice.status];
  const StatusIcon = sc.icon;

  async function handleFinalize() {
    setBusy(true);
    setError(null);
    const result = await finalizeInvoice(userId, invoice.id);
    setBusy(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMsg("Invoice finalized successfully.");
      router.refresh();
    }
  }

  async function handleVoid() {
    setBusy(true);
    setError(null);
    const result = await voidInvoice(userId, invoice.id);
    setBusy(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMsg("Invoice voided.");
      router.refresh();
    }
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);
    const result = await deleteInvoice(userId, invoice.id);
    setBusy(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.push("/invoices");
    }
  }

  return (
    <main className="invoice-printable px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        title={invoice.invoice_number}
        description={`Invoice for ${invoice.project?.name ?? "all projects"}`}
        backLink={{ href: "/invoices", label: "Back to Invoices" }}
      />

      {/* Status + Actions bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden" data-print-hide>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${sc.className}`}>
          <StatusIcon className="h-4 w-4" />
          {sc.label}
        </span>

        <div className="ml-auto flex gap-2">
          {invoice.status === "draft" && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={handleFinalize}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                {busy ? <PiSpinnerDuotone className="h-4 w-4 animate-spin" /> : <PiSealCheckDuotone className="h-4 w-4" />}
                Finalize
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleDelete}
                className="inline-flex items-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <PiTrashDuotone className="h-4 w-4" />
                Delete
              </button>
            </>
          )}
          {invoice.status === "finalized" && (
            <>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <PiPrinterDuotone className="h-4 w-4" />
                Print
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleVoid}
                className="inline-flex items-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                {busy ? <PiSpinnerDuotone className="h-4 w-4 animate-spin" /> : <PiProhibitDuotone className="h-4 w-4" />}
                Void Invoice
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400" data-print-hide>
          {error}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 print:hidden dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-400" data-print-hide>
          {successMsg}
        </div>
      )}

      {/* Summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Subtotal", value: formatCurrency(Number(invoice.subtotal)) },
          { label: "Tax", value: formatCurrency(Number(invoice.tax_amount)) },
          { label: "Total", value: formatCurrency(Number(invoice.total)) },
          { label: "Line Items", value: String(invoice.line_count) },
        ].map((card) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-sm text-stone-500 dark:text-zinc-400">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-stone-900 dark:text-white">{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Period + Metadata */}
      <div className="mb-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-4 text-base font-semibold text-stone-900 dark:text-white">Details</h3>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-stone-500 dark:text-zinc-400">Period</dt>
            <dd className="font-medium text-stone-900 dark:text-white">
              {formatDate(invoice.period_start)} – {formatDate(invoice.period_end)}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500 dark:text-zinc-400">Project</dt>
            <dd className="font-medium text-stone-900 dark:text-white">
              {invoice.project?.name ?? "All projects"}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500 dark:text-zinc-400">Created</dt>
            <dd className="font-medium text-stone-900 dark:text-white">{formatDate(invoice.created_at)}</dd>
          </div>
          {invoice.notes && (
            <div className="sm:col-span-2">
              <dt className="text-stone-500 dark:text-zinc-400">Notes</dt>
              <dd className="font-medium text-stone-900 dark:text-white">{invoice.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Line items table */}
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-stone-200 px-6 py-4 dark:border-zinc-800">
          <h3 className="text-base font-semibold text-stone-900 dark:text-white">Line Items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                <th className="px-4 py-3 font-medium text-stone-600 dark:text-zinc-400">#</th>
                <th className="px-4 py-3 font-medium text-stone-600 dark:text-zinc-400">Item</th>
                <th className="px-4 py-3 font-medium text-stone-600 dark:text-zinc-400">Category</th>
                <th className="px-4 py-3 font-medium text-stone-600 dark:text-zinc-400 text-right">Qty</th>
                <th className="px-4 py-3 font-medium text-stone-600 dark:text-zinc-400 text-right">Unit Price</th>
                <th className="px-4 py-3 font-medium text-stone-600 dark:text-zinc-400 text-right">Total</th>
                <th className="px-4 py-3 font-medium text-stone-600 dark:text-zinc-400">Sold At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
              {invoice.lines.map((line, idx) => (
                <tr key={line.id} className="transition-colors hover:bg-stone-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 text-stone-400 dark:text-zinc-500">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-stone-900 dark:text-white">{line.item_name}</div>
                    {line.item_description && (
                      <div className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400 truncate max-w-xs">
                        {line.item_description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-600 dark:text-zinc-400">{line.item_category}</td>
                  <td className="px-4 py-3 text-right text-stone-600 dark:text-zinc-400">{line.quantity}</td>
                  <td className="px-4 py-3 text-right text-stone-600 dark:text-zinc-400">{formatCurrency(Number(line.unit_price))}</td>
                  <td className="px-4 py-3 text-right font-medium text-stone-900 dark:text-white">{formatCurrency(Number(line.line_total))}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-stone-500 dark:text-zinc-500">
                    {line.sold_at ? formatDate(line.sold_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-stone-200 bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                <td colSpan={5} className="px-4 py-3 text-right font-semibold text-stone-700 dark:text-zinc-300">
                  Total
                </td>
                <td className="px-4 py-3 text-right text-lg font-bold text-stone-900 dark:text-white">
                  {formatCurrency(Number(invoice.total))}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </main>
  );
}
