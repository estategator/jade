"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Ticket,
  CircleDot,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  User,
  MessageSquare,
  Shield,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/app/components/page-header";
import {
  getAllTickets,
  getTicketStats,
  getProfileRole,
  type TicketWithOrg,
} from "@/app/developer/actions";
import type { TicketStatus } from "@/app/help/actions";
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

const PRIORITY_INDICATOR: Record<string, string> = {
  low: "bg-stone-300 dark:bg-zinc-600",
  medium: "bg-amber-400 dark:bg-amber-500",
  high: "bg-red-500 dark:bg-red-500",
};

export default function DeveloperPortalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketWithOrg[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<TicketStatus | "all">("all");
  const [stats, setStats] = useState({ total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 });

  const load = useCallback(async (uid: string) => {
    const [ticketsResult, statsResult] = await Promise.all([
      getAllTickets(uid),
      getTicketStats(uid),
    ]);
    if (ticketsResult.error) setError(ticketsResult.error);
    if (ticketsResult.data) setTickets(ticketsResult.data);
    if (!statsResult.error) setStats(statsResult);
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
      // Check developer access
      const role = await getProfileRole(session.user.id);
      if (role !== "developer") {
        router.replace("/dashboard");
        return;
      }
      load(session.user.id);
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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Developer Portal"
        description="Manage support tickets across all organizations."
      />

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Stats cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {([
          { label: "Open", value: stats.open, color: "text-[var(--color-brand-primary)]", bg: "bg-[var(--color-brand-subtle)]" },
          { label: "In Progress", value: stats.in_progress, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" },
          { label: "Resolved", value: stats.resolved, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
          { label: "Total", value: stats.total, color: "text-stone-700 dark:text-zinc-300", bg: "bg-stone-50 dark:bg-zinc-800/50" },
        ] as const).map((stat) => (
          <div
            key={stat.label}
            className={cn(
              "rounded-xl border border-stone-200 p-4 dark:border-zinc-700",
              stat.bg
            )}
          >
            <p className="text-sm font-medium text-stone-500 dark:text-zinc-400">
              {stat.label}
            </p>
            <p className={cn("mt-1 text-2xl font-bold", stat.color)}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Status filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        {(["all", "open", "in_progress", "resolved", "closed"] as const).map(
          (status) => {
            const count =
              status === "all"
                ? tickets.length
                : tickets.filter((t) => t.status === status).length;
            return (
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
                {status === "all" ? "All" : STATUS_CONFIG[status].label} ({count})
              </button>
            );
          }
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
              ? "No support tickets have been submitted yet."
              : `No ${STATUS_CONFIG[filter as TicketStatus].label.toLowerCase()} tickets.`}
          </p>
        </motion.div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/50 dark:border-zinc-800 dark:bg-zinc-800/30">
                <th className="px-4 py-3 font-medium text-stone-500 dark:text-zinc-400">
                  Ticket
                </th>
                <th className="hidden px-4 py-3 font-medium text-stone-500 dark:text-zinc-400 sm:table-cell">
                  Organization
                </th>
                <th className="hidden px-4 py-3 font-medium text-stone-500 dark:text-zinc-400 md:table-cell">
                  User
                </th>
                <th className="px-4 py-3 font-medium text-stone-500 dark:text-zinc-400">
                  Status
                </th>
                <th className="hidden px-4 py-3 font-medium text-stone-500 dark:text-zinc-400 lg:table-cell">
                  Replies
                </th>
                <th className="hidden px-4 py-3 font-medium text-stone-500 dark:text-zinc-400 sm:table-cell">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
              {filteredTickets.map((ticket) => {
                const statusCfg = STATUS_CONFIG[ticket.status];
                const StatusIcon = statusCfg.icon;

                return (
                  <tr
                    key={ticket.id}
                    className="transition-colors hover:bg-stone-50 dark:hover:bg-zinc-800/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/developer/tickets/${ticket.id}`}
                        className="group flex items-center gap-2"
                      >
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            PRIORITY_INDICATOR[ticket.priority]
                          )}
                          title={`${ticket.priority} priority`}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-stone-900 group-hover:text-[var(--color-brand-primary)] dark:text-white">
                            {ticket.title}
                          </p>
                          <p className="truncate text-xs text-stone-400 dark:text-zinc-500">
                            {ticket.category} &middot; {ticket.tier_at_creation} plan
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <span className="inline-flex items-center gap-1 text-xs text-stone-500 dark:text-zinc-400">
                        <Building2 className="h-3 w-3" />
                        {ticket.org_name}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span className="inline-flex items-center gap-1 text-xs text-stone-500 dark:text-zinc-400">
                        <User className="h-3 w-3" />
                        {ticket.user_email}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          statusCfg.color
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <span className="inline-flex items-center gap-1 text-xs text-stone-400 dark:text-zinc-500">
                        <MessageSquare className="h-3 w-3" />
                        {ticket.reply_count}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-stone-400 dark:text-zinc-500 sm:table-cell">
                      {new Date(ticket.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Developer badge */}
      <div className="mt-8 flex items-center justify-center gap-2 text-xs text-stone-400 dark:text-zinc-600">
        <Shield className="h-3.5 w-3.5" />
        Developer Portal — Staff Only
      </div>
    </div>
  );
}
