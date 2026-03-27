"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  FileSignature,
  Search,
  Trash2,
} from "lucide-react";

import type { OrgContractRow } from "@/app/onboarding/actions";
import { deleteContractDraft } from "@/app/onboarding/actions";

const statusBadge: Record<string, { text: string; className: string }> = {
  draft: { text: "Draft", className: "bg-stone-100 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300" },
  pending: { text: "Pending", className: "bg-stone-100 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300" },
  sent: { text: "Sent", className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300" },
  viewed: { text: "Viewed", className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300" },
  signed: { text: "Signed", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300" },
  declined: { text: "Declined", className: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300" },
  voided: { text: "Voided", className: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300" },
};

function StatusBadge({ status }: { status: string }) {
  const def = statusBadge[status] ?? {
    text: status,
    className: "bg-stone-100 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${def.className}`}>
      {def.text}
    </span>
  );
}

export function ContractTable({
  contracts,
}: Readonly<{
  contracts: OrgContractRow[];
}>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return contracts;
    return contracts.filter(
      (c) =>
        c.clientName.toLowerCase().includes(q) ||
        c.projectName.toLowerCase().includes(q) ||
        (c.signer_email ?? "").toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q),
    );
  }, [search, contracts]);

  if (contracts.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-stone-300 px-6 py-12 text-center dark:border-zinc-700">
        <FileSignature className="mx-auto h-8 w-8 text-stone-300 dark:text-zinc-600" />
        <p className="mt-3 text-sm text-stone-500 dark:text-zinc-500">
          No contracts yet. Create a contract from a client&apos;s detail page to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-zinc-500" />
        <input
          type="text"
          placeholder="Search by client, project, email, or status…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-2xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm text-stone-900 outline-none transition focus:border-[var(--color-brand-primary)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 dark:border-zinc-800 dark:bg-zinc-950/50">
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-500">
                  Client
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-500">
                  Project
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-500">
                  Provider
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-500">
                  Status
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-500">
                  Commission
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-500">
                  Signer
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-500">
                  Date
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="transition hover:bg-stone-50 dark:hover:bg-zinc-950/40"
                >
                  <td className="whitespace-nowrap px-6 py-4">
                    <Link
                      href={`/clients/${c.clientId}`}
                      className="font-medium text-stone-900 hover:text-[var(--color-brand-primary)] dark:text-white"
                    >
                      {c.clientName}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-stone-700 dark:text-zinc-300">
                    {c.projectName}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-stone-700 dark:text-zinc-300">
                    {c.provider}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-stone-700 dark:text-zinc-300">
                    {c.commission_rate != null ? `${c.commission_rate}%` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-stone-700 dark:text-zinc-300">
                    {c.signer_email ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-stone-500 dark:text-zinc-500">
                    {new Date(c.created_at).toLocaleDateString()}
                    {c.signed_at && (
                      <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                        (signed {new Date(c.signed_at).toLocaleDateString()})
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {c.status === "draft" && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => {
                            if (!confirm("Delete this draft contract?")) return;
                            setError(null);
                            startTransition(async () => {
                              const res = await deleteContractDraft(c.id);
                              if (res.error) {
                                setError(res.error);
                                return;
                              }
                              router.refresh();
                            });
                          }}
                          className="text-stone-400 transition hover:text-red-600 disabled:opacity-60 dark:text-zinc-500 dark:hover:text-red-400"
                          title="Delete draft"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      <Link
                        href={`/clients/${c.clientId}`}
                        className="text-stone-400 transition hover:text-[var(--color-brand-primary)] dark:text-zinc-500"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-8 text-center text-sm text-stone-500 dark:text-zinc-500"
                  >
                    No contracts match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
