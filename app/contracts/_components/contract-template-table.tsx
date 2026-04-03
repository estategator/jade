"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  FileSignature,
  Pencil,
  Plus,
  Search,
} from "lucide-react";

import type { ContractTemplateRow } from "@/app/contracts/actions";
import { archiveContractTemplate } from "@/app/contracts/actions";

const statusBadge: Record<string, { text: string; className: string }> = {
  active: {
    text: "Active",
    className:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
  },
  archived: {
    text: "Archived",
    className:
      "bg-stone-100 text-stone-500 dark:bg-zinc-800 dark:text-zinc-400",
  },
};

function StatusBadge({ status }: { status: string }) {
  const def = statusBadge[status] ?? {
    text: status,
    className:
      "bg-stone-100 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${def.className}`}
    >
      {def.text}
    </span>
  );
}

export function ContractTemplateTable({
  templates,
  error: loadError,
  canManageTemplates = true,
}: Readonly<{
  templates: ContractTemplateRow[];
  error?: string;
  canManageTemplates?: boolean;
}>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(loadError ?? null);

  const filtered = search.trim()
    ? templates.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase().trim()),
      )
    : templates;

  if (templates.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-stone-300 px-6 py-12 text-center dark:border-zinc-700">
        <FileSignature className="mx-auto h-8 w-8 text-stone-300 dark:text-zinc-600" />
        <p className="mt-3 text-sm text-stone-500 dark:text-zinc-500">
          No contract templates yet. Create one to get started.
        </p>
        {canManageTemplates && (
          <Link
            href="/contracts/templates/new"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-primary)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-brand-primary-hover)]"
          >
            <Plus className="h-4 w-4" />
            Create template
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm text-stone-900 outline-none transition focus:border-[var(--color-brand-primary)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
          />
        </div>
        {canManageTemplates && (
          <Link
            href="/contracts/templates/new"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-primary)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-brand-primary-hover)]"
          >
            <Plus className="h-4 w-4" />
            Create template
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 dark:border-zinc-800 dark:bg-zinc-950/50">
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-500">
                  Name
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-500">
                  Type
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-500">
                  Status
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-500">
                  Created
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  className="transition hover:bg-stone-50 dark:hover:bg-zinc-950/40"
                >
                  <td className="whitespace-nowrap px-6 py-4 font-medium text-stone-900 dark:text-white">
                    {t.name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-stone-700 dark:text-zinc-300">
                    {t.agreement_type === "estate_sale"
                      ? "Estate Sale"
                      : t.agreement_type === "buyout"
                        ? "Buyout"
                        : t.agreement_type}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-stone-500 dark:text-zinc-500">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {canManageTemplates && t.status === "active" && t.docuseal_template_id && (
                        <Link
                          href={`/contracts/templates/${t.id}/edit`}
                          className="text-stone-400 transition hover:text-[var(--color-brand-primary)] dark:text-zinc-500"
                          title="Edit template"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                      )}
                      {canManageTemplates && t.status === "active" && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => {
                            if (
                              !confirm(
                                "Archive this template? It will no longer be available for new contracts.",
                              )
                            )
                              return;
                            setError(null);
                            startTransition(async () => {
                              const res = await archiveContractTemplate(t.id);
                              if (res.error) {
                                setError(res.error);
                                return;
                              }
                              router.refresh();
                            });
                          }}
                          className="text-stone-400 transition hover:text-red-600 disabled:opacity-60 dark:text-zinc-500 dark:hover:text-red-400"
                          title="Archive template"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-sm text-stone-500 dark:text-zinc-500"
                  >
                    No templates match your search.
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
