"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  PiArrowLeftDuotone,
  PiClockDuotone,
  PiCheckCircleDuotone,
  PiWarningCircleDuotone,
  PiCircleDuotone,
  PiSpinnerDuotone,
  PiPaperPlaneRightDuotone,
  PiUserDuotone,
  PiShieldDuotone,
} from "react-icons/pi";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getActiveOrgId } from "@/lib/active-org";
import {
  getTicket,
  replyToTicket,
  type SupportTicket,
  type TicketReply,
  type TicketStatus,
} from "@/app/help/actions";
import { cn } from "@/lib/cn";

const STATUS_CONFIG: Record<
  TicketStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  open: {
    label: "Open",
    icon: PiCircleDuotone,
    color: "text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/20",
  },
  in_progress: {
    label: "In Progress",
    icon: PiClockDuotone,
    color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20",
  },
  resolved: {
    label: "Resolved",
    icon: PiCheckCircleDuotone,
    color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20",
  },
  closed: {
    label: "Closed",
    icon: PiWarningCircleDuotone,
    color: "text-stone-500 bg-stone-100 dark:text-zinc-400 dark:bg-zinc-800",
  },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-stone-600 bg-stone-100 dark:text-zinc-400 dark:bg-zinc-800",
  medium: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20",
  high: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20",
};

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<(SupportTicket & { replies: TicketReply[] }) | null>(null);
  const [error, setError] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  const loadTicket = useCallback(
    async (oid: string) => {
      const result = await getTicket(ticketId, oid);
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setTicket(result.data);
      }
      setLoading(false);
    },
    [ticketId]
  );

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      setUserId(session.user.id);
      const oid = getActiveOrgId();
      if (!oid) {
        setError("No organization selected.");
        setLoading(false);
        return;
      }
      setOrgId(oid);
      loadTicket(oid);
    }
    init();
  }, [router, loadTicket]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !userId || !replyText.trim()) return;

    setReplySubmitting(true);
    setReplyError("");

    const result = await replyToTicket(ticketId, orgId, userId, replyText);
    if (result.error) {
      setReplyError(result.error);
      setReplySubmitting(false);
      return;
    }

    setReplyText("");
    setReplySubmitting(false);
    // Reload ticket
    loadTicket(orgId);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <PiSpinnerDuotone className="h-6 w-6 animate-spin text-stone-400 dark:text-zinc-500" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/help/tickets"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white"
        >
          <PiArrowLeftDuotone className="h-4 w-4" />
          Back to Tickets
        </Link>
        <div className="rounded-xl border border-stone-200 bg-white py-16 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <PiWarningCircleDuotone className="mx-auto h-10 w-10 text-stone-300 dark:text-zinc-600" />
          <p className="mt-3 text-sm text-stone-500 dark:text-zinc-400">
            {error || "Ticket not found."}
          </p>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[ticket.status];
  const StatusIcon = statusCfg.icon;
  const isClosed = ticket.status === "closed";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href="/dashboard/help/tickets"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white"
      >
        <PiArrowLeftDuotone className="h-4 w-4" />
        Back to Tickets
      </Link>

      {/* Ticket header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 rounded-xl border border-stone-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-xl font-bold text-stone-900 dark:text-white">
            {ticket.title}
          </h1>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
              statusCfg.color
            )}
          >
            <StatusIcon className="h-3 w-3" />
            {statusCfg.label}
          </span>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-stone-600 dark:text-zinc-400">
          {ticket.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
              PRIORITY_COLORS[ticket.priority]
            )}
          >
            {ticket.priority} priority
          </span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium capitalize text-stone-600 dark:bg-zinc-800 dark:text-zinc-400">
            {ticket.category}
          </span>
          <span className="text-xs text-stone-400 dark:text-zinc-500">
            Submitted{" "}
            {new Date(ticket.created_at).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
      </motion.div>

      {/* Replies */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-stone-900 dark:text-white">
          Replies ({ticket.replies.length})
        </h2>

        {ticket.replies.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white py-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-stone-500 dark:text-zinc-400">
              No replies yet. Our team will respond soon.
            </p>
          </div>
        ) : (
          ticket.replies.map((reply) => (
            <motion.div
              key={reply.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "rounded-xl border p-4",
                reply.is_admin
                  ? "border-indigo-200 bg-indigo-50/50 dark:border-indigo-800/50 dark:bg-indigo-950/20"
                  : "border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full",
                    reply.is_admin
                      ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400"
                      : "bg-stone-100 text-stone-500 dark:bg-zinc-800 dark:text-zinc-400"
                  )}
                >
                  {reply.is_admin ? (
                    <PiShieldDuotone className="h-3 w-3" />
                  ) : (
                    <PiUserDuotone className="h-3 w-3" />
                  )}
                </div>
                <span className="text-xs font-medium text-stone-700 dark:text-zinc-300">
                  {reply.is_admin ? "Support Team" : "You"}
                </span>
                <span className="text-xs text-stone-400 dark:text-zinc-500">
                  {new Date(reply.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-stone-600 dark:text-zinc-400">
                {reply.message}
              </p>
            </motion.div>
          ))
        )}
      </div>

      {/* Reply form */}
      {!isClosed && userId && (
        <form onSubmit={handleReply} className="mt-6">
          <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              rows={3}
              maxLength={5000}
              className="w-full resize-none border-0 bg-transparent text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none dark:text-white dark:placeholder:text-zinc-500"
            />
            {replyError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{replyError}</p>
            )}
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={replySubmitting || !replyText.trim()}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                  replySubmitting || !replyText.trim()
                    ? "cursor-not-allowed bg-indigo-400 dark:bg-indigo-600/50"
                    : "bg-indigo-600 hover:bg-indigo-700"
                )}
              >
                {replySubmitting ? (
                  <PiSpinnerDuotone className="h-4 w-4 animate-spin" />
                ) : (
                  <PiPaperPlaneRightDuotone className="h-4 w-4" />
                )}
                {replySubmitting ? "Sending..." : "Reply"}
              </button>
            </div>
          </div>
        </form>
      )}

      {isClosed && (
        <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 p-4 text-center text-sm text-stone-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
          This ticket is closed and no longer accepts replies.
        </div>
      )}
    </div>
  );
}
