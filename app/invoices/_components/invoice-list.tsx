"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  PiFileTextDuotone,
  PiSpinnerDuotone,
  PiMagnifyingGlassDuotone,
  PiTrashDuotone,
  PiWarningDuotone,
  PiPrinterDuotone,
} from "react-icons/pi";
import { getInvoices, deleteInvoice, type InvoiceListItem } from "@/app/invoices/actions";
import { statusConfig, formatCurrency, formatDate } from "@/app/invoices/_components/invoice-utils";
import { Modal } from "@/app/components/ui/modal";

type Props = {
  userId: string;
  orgId: string;
  initialInvoices: InvoiceListItem[];
  initialHasMore: boolean;
};



export function InvoiceList({ userId, orgId, initialInvoices, initialHasMore }: Props) {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>(initialInvoices);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<InvoiceListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(initialHasMore);
  // Track whether user has triggered a filter change (skip initial mount fetch)
  const [hasUserFiltered, setHasUserFiltered] = useState(false);

  // Sync with server-provided data when parent re-renders (e.g. after router.refresh())
  useEffect(() => {
    setInvoices(initialInvoices);
    setHasMore(initialHasMore);
  }, [initialInvoices, initialHasMore]);

  // Reset page when filter changes
  const loadInvoices = useCallback(async (pageNum: number, append: boolean) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);
    const result = await getInvoices(userId, orgId, statusFilter, pageNum);
    if (result.error) {
      setError(result.error);
    } else {
      setInvoices((prev) => append ? [...prev, ...(result.data ?? [])] : (result.data ?? []));
      setHasMore(result.hasMore ?? false);
      setPage(pageNum);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [userId, orgId, statusFilter]);

  // Only re-fetch when user changes filter;
  // initial data is already provided server-side.
  useEffect(() => {
    if (hasUserFiltered) {
      loadInvoices(0, false);
    }
  }, [loadInvoices, hasUserFiltered]);

  const filtered = invoices.filter((inv) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.invoice_number.toLowerCase().includes(q) ||
      inv.project?.name?.toLowerCase().includes(q) ||
      inv.notes.toLowerCase().includes(q)
    );
  });

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deleteInvoice(userId, deleteTarget.id);
    setDeleting(false);
    if (result.error) {
      setError(result.error);
    } else {
      setDeleteTarget(null);
      loadInvoices(0, false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <PiMagnifyingGlassDuotone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoices…"
            className="w-full rounded-xl border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm text-stone-900 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-indigo-400"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "draft", "finalized", "void"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setStatusFilter(s); setHasUserFiltered(true); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                  : "text-stone-500 hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <PiSpinnerDuotone className="h-6 w-6 animate-spin text-indigo-500" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100 dark:bg-zinc-800">
            <PiFileTextDuotone className="h-8 w-8 text-stone-400 dark:text-zinc-500" />
          </div>
          <h3 className="text-base font-semibold text-stone-900 dark:text-white">No invoices yet</h3>
          <p className="mt-1 text-sm text-stone-500 dark:text-zinc-400">
            Generate your first invoice using the form above.
          </p>
        </div>
      ) : (
        <>
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <th className="px-4 py-3 font-medium text-stone-600 dark:text-zinc-400">Invoice #</th>
                  <th className="px-4 py-3 font-medium text-stone-600 dark:text-zinc-400">Status</th>
                  <th className="px-4 py-3 font-medium text-stone-600 dark:text-zinc-400">Period</th>
                  <th className="px-4 py-3 font-medium text-stone-600 dark:text-zinc-400">Project</th>
                  <th className="px-4 py-3 font-medium text-stone-600 dark:text-zinc-400 text-right">Lines</th>
                  <th className="px-4 py-3 font-medium text-stone-600 dark:text-zinc-400 text-right">Total</th>
                  <th className="px-4 py-3 font-medium text-stone-600 dark:text-zinc-400">Created</th>
                  <th className="px-4 py-3 w-24"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                {filtered.map((inv) => {
                  const sc = statusConfig[inv.status];
                  const StatusIcon = sc.icon;
                  return (
                    <tr
                      key={inv.id}
                      className="transition-colors hover:bg-stone-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${sc.className}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-stone-600 dark:text-zinc-400">
                        {formatDate(inv.period_start)} – {formatDate(inv.period_end)}
                      </td>
                      <td className="px-4 py-3 text-stone-600 dark:text-zinc-400">
                        {inv.project?.name ?? "All"}
                      </td>
                      <td className="px-4 py-3 text-right text-stone-600 dark:text-zinc-400">
                        {inv.line_count}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-stone-900 dark:text-white">
                        {formatCurrency(Number(inv.total))}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-stone-500 dark:text-zinc-500">
                        {formatDate(inv.created_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {inv.status === "finalized" && (
                            <Link
                              href={`/invoices/${inv.id}`}
                              onClick={(e) => {
                                e.preventDefault();
                                const printWindow = window.open(`/invoices/${inv.id}`, '_blank');
                                if (printWindow) {
                                  printWindow.addEventListener('afterprint', () => printWindow.close());
                                  printWindow.addEventListener('load', () => {
                                    setTimeout(() => printWindow.print(), 500);
                                  });
                                }
                              }}
                              className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:text-zinc-500 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400"
                              title="Print invoice"
                            >
                              <PiPrinterDuotone className="h-4 w-4" />
                            </Link>
                          )}
                          {inv.status === "draft" && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(inv)}
                              className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                              title="Delete draft"
                            >
                              <PiTrashDuotone className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Load More */}
        {hasMore && (
          <div className="flex justify-center pt-4">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => loadInvoices(page + 1, true)}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {loadingMore && <PiSpinnerDuotone className="h-4 w-4 animate-spin" />}
              Load more
            </button>
          </div>
        )}
        </>
      )}

      {/* Delete confirmation modal */}
      <Modal open={!!deleteTarget} size="sm">
        {deleteTarget && (
          <>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <PiWarningDuotone className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-stone-900 dark:text-white">Delete Invoice</h3>
                  <p className="mt-1 text-sm text-stone-500 dark:text-zinc-400">
                    Are you sure you want to delete <span className="font-medium">{deleteTarget.invoice_number}</span>? This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-600"
                >
                  {deleting && <PiSpinnerDuotone className="h-4 w-4 animate-spin" />}
                  Delete
                </button>
              </div>
          </>
        )}
      </Modal>
    </div>
  );
}
