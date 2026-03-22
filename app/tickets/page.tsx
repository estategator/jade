"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Ticket,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CircleDot,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getActiveOrgId } from "@/lib/active-org";
import { PageHeader } from "@/app/components/page-header";
import { getTickets, type SupportTicket, type TicketStatus } from "@/app/help/actions";
import { cn } from "@/lib/cn";

const STATUS_CONFIG: Record<
  TicketStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  open: {
    label: "Open",
    icon: CircleDot,
    color: "text-[var(--color-brand-primary)] bg-[var(--color-brand-subtle)]",
  },
  in_progress: {
    label: "In Progress",
    icon: Clock,
    color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20",
  },
  resolved: {
    label: "Resolved",
    icon: CheckCircle2,
    color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20",
  },
  closed: {
    label: "Closed",
    icon: AlertCircle,
    color: "text-stone-500 bg-stone-100 dark:text-zinc-400 dark:bg-zinc-800",
  },
};

export default function TicketsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<TicketStatus | "all">("open");

  const load = useCallback(async () => {
    const orgId = getActiveOrgId();
    if (!orgId) {
      setError("No organization selected.");
      setLoading(false);
      return;
    }
    const result = await getTickets(orgId);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setTickets(result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      load();
    }
    init();
  }, [router, load]);

  const filteredTickets =
    filter === "all" ? tickets : tickets.filter((t) => t.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400 dark:text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="My Tickets"
        description="Track your support tickets and their status."
        action={{ label: "New Ticket", href: "/tickets/new", icon: Plus }}
      />

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Status filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        {(["all", "open", "in_progress", "resolved", "closed"] as const).map(
          (status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                filter === status
                  ? "bg-[var(--color-brand-subtle)] text-[var(--color-brand-primary)]"
                  : "text-stone-500 hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              )}
            >
              {status === "all"
                ? `All (${tickets.length})`
                : `${STATUS_CONFIG[status].label} (${tickets.filter((t) => t.status === status).length})`}
            </button>
          )
        )}
      </div>

      {/* Ticket list */}
      {filteredTickets.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-stone-200 bg-white py-16 text-center dark:border-zinc-700 dark:bg-zinc-900"
        >
          <Ticket className="mx-auto h-10 w-10 text-stone-300 dark:text-zinc-600" />
          <p className="mt-3 text-sm font-medium text-stone-900 dark:text-white">
            No tickets found
          </p>
          <p className="mt-1 text-sm text-stone-500 dark:text-zinc-400">
            {filter === "all"
              ? "You haven't submitted any support tickets yet."
              : `No ${STATUS_CONFIG[filter as TicketStatus].label.toLowerCase()} tickets.`}
          </p>
          <Link
            href="/tickets/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-brand-primary-hover)]"
          >
            <Plus className="h-4 w-4" />
            Submit New Ticket
          </Link>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => {
            const statusCfg = STATUS_CONFIG[ticket.status];
            const StatusIcon = statusCfg.icon;

            return (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Link
                  href={`/tickets/${ticket.id}`}
                  className="group block rounded-xl border border-stone-200 bg-white p-4 transition-colors hover:border-[var(--color-brand-primary)]/30 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-[var(--color-brand-primary)]/40"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-medium text-stone-900 group-hover:text-[var(--color-brand-primary)] dark:text-white">
                        {ticket.title}
                      </h3>
                      <p className="mt-1 line-clamp-1 text-sm text-stone-500 dark:text-zinc-400">
                        {ticket.description}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-stone-400 dark:text-zinc-500">
                        <span className="capitalize">{ticket.category}</span>
                        <span>
                          {new Date(ticket.created_at).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" }
                          )}
                        </span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                        statusCfg.color
                      )}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {statusCfg.label}
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
