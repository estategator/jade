"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ScrollText, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

type AuditEntry = {
  id: string;
  action: string;
  actor_id: string;
  actor_email?: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

type AuditLogViewProps = Readonly<{
  orgId: string;
  canView: boolean;
}>;

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  "org.created": { label: "Organization created", color: "text-emerald-600 dark:text-emerald-400" },
  "org.updated": { label: "Organization updated", color: "text-indigo-600 dark:text-indigo-400" },
  "org.deleted": { label: "Organization deleted", color: "text-red-600 dark:text-red-400" },
  "member.invited": { label: "Member invited", color: "text-indigo-600 dark:text-indigo-400" },
  "member.removed": { label: "Member removed", color: "text-red-600 dark:text-red-400" },
  "member.role_changed": { label: "Role changed", color: "text-indigo-600 dark:text-indigo-400" },
  "member.status_changed": { label: "Status changed", color: "text-stone-600 dark:text-zinc-400" },
  "settings.updated": { label: "Settings updated", color: "text-indigo-600 dark:text-indigo-400" },
  "billing.subscription_changed": { label: "Subscription changed", color: "text-violet-600 dark:text-violet-400" },
  "billing.stripe_connected": { label: "Stripe connected", color: "text-emerald-600 dark:text-emerald-400" },
  "inventory.created": { label: "Item created", color: "text-emerald-600 dark:text-emerald-400" },
  "inventory.updated": { label: "Item updated", color: "text-indigo-600 dark:text-indigo-400" },
  "inventory.deleted": { label: "Item deleted", color: "text-red-600 dark:text-red-400" },
};

const PAGE_SIZE = 20;

export function AuditLogView({ orgId, canView }: AuditLogViewProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [hasMore, setHasMore] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!canView) return;
    setLoading(true);

    let query = supabase
      .from("audit_log")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    if (search) {
      query = query.ilike("action", `%${search}%`);
    }

    const { data } = await query;
    setEntries((data as AuditEntry[] | null) ?? []);
    setHasMore((data?.length ?? 0) > PAGE_SIZE);
    setLoading(false);
  }, [orgId, canView, page, search]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  if (!canView) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white px-5 py-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <ScrollText className="mx-auto mb-2 h-6 w-6 text-stone-300 dark:text-zinc-600" />
        <p className="text-sm text-stone-500 dark:text-zinc-400">
          You don&apos;t have permission to view the audit log.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400 dark:text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Filter by action..."
          className="settings-input pl-9"
        />
      </div>

      {/* Log Table */}
      <div className="rounded-xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-stone-100 px-5 py-3 dark:border-zinc-800/60">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-white">Activity Log</h2>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-stone-500 dark:text-zinc-400">
            Loading...
          </div>
        ) : entries.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <ScrollText className="mx-auto mb-2 h-6 w-6 text-stone-300 dark:text-zinc-600" />
            <p className="text-sm text-stone-500 dark:text-zinc-400">No audit entries found</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-zinc-800/60">
            {entries.slice(0, PAGE_SIZE).map((entry) => {
              const actionInfo = ACTION_LABELS[entry.action] ?? {
                label: entry.action,
                color: "text-stone-600 dark:text-zinc-400",
              };

              return (
                <div key={entry.id} className="flex items-center justify-between px-5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${actionInfo.color}`}>
                      {actionInfo.label}
                    </p>
                    <p className="truncate text-[11px] text-stone-500 dark:text-zinc-500">
                      {entry.actor_email || entry.actor_id.slice(0, 8)}
                      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                        <> &middot; {JSON.stringify(entry.metadata).slice(0, 60)}</>
                      )}
                    </p>
                  </div>
                  <time className="shrink-0 text-[11px] text-stone-400 dark:text-zinc-500">
                    {new Date(entry.created_at).toLocaleDateString()}{" "}
                    {new Date(entry.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </time>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-stone-100 px-5 py-2.5 dark:border-zinc-800/60">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </button>
          <span className="text-[11px] text-stone-500 dark:text-zinc-500">
            Page {page + 1}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
