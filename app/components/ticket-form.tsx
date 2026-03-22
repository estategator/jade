"use client";

import { useState } from "react";
import { Loader2, AlertCircle, ArrowUpCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { submitTicket, type TicketCategory, type TicketPriority } from "@/app/help/actions";
import type { SubscriptionTier } from "@/lib/tiers";
import Link from "next/link";

type TicketFormProps = Readonly<{
  orgId: string;
  userId: string;
  tier: SubscriptionTier;
  ticketsUsed: number;
  ticketLimit: number;
  allowedPriorities: TicketPriority[];
}>;

const CATEGORY_OPTIONS: { value: TicketCategory; label: string }[] = [
  { value: "general", label: "General Question" },
  { value: "bug", label: "Bug Report" },
  { value: "feature", label: "Feature Request" },
  { value: "billing", label: "Billing" },
];

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High (Priority)" },
];

export function TicketForm({
  orgId,
  userId,
  tier,
  ticketsUsed,
  ticketLimit,
  allowedPriorities,
}: TicketFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const atLimit = ticketLimit !== Infinity && ticketsUsed >= ticketLimit;
  const remaining = ticketLimit === Infinity ? Infinity : ticketLimit - ticketsUsed;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const result = await submitTicket(orgId, userId, formData);

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
    (e.target as HTMLFormElement).reset();
  }

  if (atLimit) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-stone-400 dark:text-zinc-500" />
          <div>
            <p className="font-medium text-stone-900 dark:text-white">
              Monthly ticket limit reached
            </p>
            <p className="mt-1 text-sm text-stone-500 dark:text-zinc-400">
              You&apos;ve used all {ticketLimit} tickets this month on the{" "}
              <span className="font-medium capitalize">{tier}</span> plan.
            </p>
            {tier !== "enterprise" && (
              <Link
                href="/pricing"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                <ArrowUpCircle className="h-4 w-4" />
                Upgrade for more tickets
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Tier info banner */}
      <div className="flex items-center justify-between rounded-lg bg-stone-50 px-4 py-2.5 text-sm dark:bg-zinc-800/50">
        <span className="text-stone-600 dark:text-zinc-400">
          <span className="font-medium capitalize text-stone-900 dark:text-white">
            {tier}
          </span>{" "}
          plan
        </span>
        <span className="text-stone-500 dark:text-zinc-500">
          {remaining === Infinity
            ? "Unlimited tickets"
            : `${remaining} ticket${remaining !== 1 ? "s" : ""} remaining this month`}
        </span>
      </div>

      {/* Title */}
      <div>
        <label
          htmlFor="ticket-title"
          className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300"
        >
          Subject
        </label>
        <input
          id="ticket-title"
          name="title"
          type="text"
          required
          maxLength={200}
          placeholder="Brief summary of your issue"
          className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-indigo-500"
        />
      </div>

      {/* Category + Priority row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="ticket-category"
            className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300"
          >
            Category
          </label>
          <select
            id="ticket-category"
            name="category"
            className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-indigo-500"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="ticket-priority"
            className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300"
          >
            Priority
          </label>
          <select
            id="ticket-priority"
            name="priority"
            className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-indigo-500"
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={!allowedPriorities.includes(opt.value)}
              >
                {opt.label}
                {!allowedPriorities.includes(opt.value) ? " (upgrade required)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="ticket-description"
          className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300"
        >
          Description
        </label>
        <textarea
          id="ticket-description"
          name="description"
          required
          maxLength={5000}
          rows={5}
          placeholder="Describe your issue or feedback in detail..."
          className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-indigo-500"
        />
      </div>

      {/* Error / Success */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
          Ticket submitted successfully! We&apos;ll get back to you soon.
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
          submitting
            ? "cursor-not-allowed bg-indigo-400 dark:bg-indigo-600/50"
            : "bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500"
        )}
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? "Submitting..." : "Submit Ticket"}
      </button>
    </form>
  );
}
