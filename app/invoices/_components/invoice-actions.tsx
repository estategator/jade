"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PiSpinnerDuotone,
  PiSealCheckDuotone,
  PiTrashDuotone,
  PiPrinterDuotone,
  PiProhibitDuotone,
} from "react-icons/pi";
import {
  finalizeInvoice,
  voidInvoice,
  deleteInvoice,
} from "@/app/invoices/actions";
import { statusConfig } from "@/app/invoices/_components/invoice-utils";

type Props = {
  userId: string;
  invoiceId: string;
  status: "draft" | "finalized" | "void";
};

export function InvoiceActions({ userId, invoiceId, status }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const sc = statusConfig[status];
  const StatusIcon = sc.icon;

  async function handleFinalize() {
    setBusy(true);
    setError(null);
    const result = await finalizeInvoice(userId, invoiceId);
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
    const result = await voidInvoice(userId, invoiceId);
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
    const result = await deleteInvoice(userId, invoiceId);
    setBusy(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.push("/invoices");
    }
  }

  return (
    <>
      {/* Status + Actions bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${sc.className}`}>
          <StatusIcon className="h-4 w-4" />
          {sc.label}
        </span>

        <div className="ml-auto flex gap-2">
          {status === "draft" && (
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
          {status === "finalized" && (
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
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-400">
          {successMsg}
        </div>
      )}
    </>
  );
}
