"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tag,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Gift,
  Copy,
  Check,
  Search,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/app/components/page-header";
import {
  createDiscountCode,
  listDiscountCodes,
  revokeDiscountCode,
  applyDiscountToSubscription,
  getSubscribedOrgs,
  getProfileRole,
  type DiscountCodeWithContext,
} from "@/app/discounts/actions";
import { cn } from "@/lib/cn";

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  active: {
    label: "Active",
    icon: CheckCircle2,
    color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20",
  },
  redeemed: {
    label: "Redeemed",
    icon: Gift,
    color: "text-[var(--color-brand-primary)] bg-[var(--color-brand-subtle)]",
  },
  revoked: {
    label: "Revoked",
    icon: XCircle,
    color: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20",
  },
  expired: {
    label: "Expired",
    icon: Clock,
    color: "text-stone-500 bg-stone-100 dark:text-zinc-400 dark:bg-zinc-800",
  },
};

type StatusFilter = "all" | "active" | "redeemed" | "revoked" | "expired";

export default function SupportSubscriptionsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [codes, setCodes] = useState<DiscountCodeWithContext[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formPercent, setFormPercent] = useState(10);
  const [formDuration, setFormDuration] = useState(1);
  const [formNote, setFormNote] = useState("");

  // Apply form state
  const [applyingCodeId, setApplyingCodeId] = useState<string | null>(null);
  const [applyOrgId, setApplyOrgId] = useState("");
  const [applyLoading, setApplyLoading] = useState(false);
  const [subscribedOrgs, setSubscribedOrgs] = useState<
    { org_id: string; org_name: string; tier: string; status: string }[]
  >([]);

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async (uid: string) => {
    const [codesResult, orgsResult] = await Promise.all([
      listDiscountCodes(uid, "all"),
      getSubscribedOrgs(uid),
    ]);
    if (codesResult.error) setError(codesResult.error);
    if (codesResult.data) setCodes(codesResult.data);
    if (orgsResult.data) setSubscribedOrgs(orgsResult.data);
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
      const role = await getProfileRole(session.user.id);
      if (role !== "developer" && role !== "support") {
        router.replace("/dashboard");
        return;
      }
      setUserId(session.user.id);
      load(session.user.id);
    }
    init();
  }, [router, load]);

  const filteredCodes = codes.filter((c) => {
    const matchesFilter = filter === "all" || c.status === filter;
    const matchesSearch =
      !search ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.target_email.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  async function handleCreate() {
    setCreating(true);
    setError("");
    setSuccess("");

    const result = await createDiscountCode(userId, {
      targetUserEmail: formEmail,
      percentOff: formPercent,
      durationMonths: formDuration,
      note: formNote || undefined,
    });

    if (result.error) {
      setError(result.error);
      setCreating(false);
      return;
    }

    setSuccess(`Code ${result.data?.code} created successfully.`);
    setShowCreate(false);
    setFormEmail("");
    setFormPercent(10);
    setFormDuration(1);
    setFormNote("");
    setCreating(false);
    load(userId);
  }

  async function handleRevoke(codeId: string) {
    setError("");
    setSuccess("");
    const result = await revokeDiscountCode(userId, codeId);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess("Code revoked.");
    load(userId);
  }

  async function handleApply() {
    if (!applyingCodeId || !applyOrgId) return;
    setApplyLoading(true);
    setError("");
    setSuccess("");

    const result = await applyDiscountToSubscription(userId, applyingCodeId, applyOrgId);
    if (result.error) {
      setError(result.error);
      setApplyLoading(false);
      return;
    }

    setSuccess("Discount applied to subscription.");
    setApplyingCodeId(null);
    setApplyOrgId("");
    setApplyLoading(false);
    load(userId);
  }

  function handleCopy(code: string, id: string) {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

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
        title="Subscription Discounts"
        description="Create and manage user-specific subscription discount codes."
        backLink={{ href: "/dashboard", label: "Dashboard" }}
        action={{
          label: "New Code",
          onClick: () => setShowCreate(true),
          variant: "primary",
          icon: Plus,
        }}
      />

      {/* Feedback banners */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
            <button
              type="button"
              onClick={() => setError("")}
              className="ml-auto text-red-400 hover:text-red-600 dark:hover:text-red-300"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mb-6 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {success}
            <button
              type="button"
              onClick={() => setSuccess("")}
              className="ml-auto text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8 overflow-hidden"
          >
            <div className="rounded-xl border border-stone-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
              <h3 className="mb-4 text-sm font-semibold text-stone-900 dark:text-white">
                Create Discount Code
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-zinc-400">
                    Target User Email
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-zinc-400">
                    Discount % (1–50)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={formPercent}
                    onChange={(e) => setFormPercent(Number(e.target.value))}
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-zinc-400">
                    Duration (1–3 months)
                  </label>
                  <select
                    value={formDuration}
                    onChange={(e) => setFormDuration(Number(e.target.value))}
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  >
                    <option value={1}>1 month</option>
                    <option value={2}>2 months</option>
                    <option value={3}>3 months</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-zinc-400">
                    Internal Note (optional)
                  </label>
                  <input
                    type="text"
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    placeholder="e.g. Retention discount for churning user"
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                  />
                </div>
              </div>
              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  disabled={creating || !formEmail}
                  onClick={handleCreate}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Create Code
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition-all hover:bg-stone-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Apply modal */}
      <AnimatePresence>
        {applyingCodeId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-70 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => { setApplyingCodeId(null); setApplyOrgId(""); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="mx-4 w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            >
              <h3 className="mb-4 text-sm font-semibold text-stone-900 dark:text-white">
                Apply Discount to Subscription
              </h3>
              <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-zinc-400">
                Select Organization
              </label>
              <select
                value={applyOrgId}
                onChange={(e) => setApplyOrgId(e.target.value)}
                className="mb-4 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="">Choose an org...</option>
                {subscribedOrgs.map((org) => (
                  <option key={org.org_id} value={org.org_id}>
                    {org.org_name} ({org.tier} — {org.status})
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={applyLoading || !applyOrgId}
                  onClick={handleApply}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {applyLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => { setApplyingCodeId(null); setApplyOrgId(""); }}
                  className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition-all hover:bg-stone-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search & filter */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Search by code or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 sm:w-72"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "active", "redeemed", "revoked", "expired"] as const).map((s) => {
            const count =
              s === "all" ? codes.length : codes.filter((c) => c.status === s).length;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === s
                    ? "bg-[var(--color-brand-subtle)] text-[var(--color-brand-primary)]"
                    : "text-stone-500 hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                )}
              >
                {s === "all" ? "All" : STATUS_CONFIG[s].label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Codes table */}
      {filteredCodes.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-stone-200 bg-white py-16 text-center dark:border-zinc-700 dark:bg-zinc-900"
        >
          <Tag className="mx-auto h-10 w-10 text-stone-300 dark:text-zinc-600" />
          <p className="mt-3 text-sm font-medium text-stone-900 dark:text-white">
            No discount codes found
          </p>
          <p className="mt-1 text-sm text-stone-500 dark:text-zinc-400">
            {filter === "all"
              ? "Create your first discount code to get started."
              : `No ${STATUS_CONFIG[filter].label.toLowerCase()} codes.`}
          </p>
        </motion.div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/50 dark:border-zinc-800 dark:bg-zinc-800/30">
                  <th className="px-4 py-3 font-medium text-stone-500 dark:text-zinc-400">Code</th>
                  <th className="hidden px-4 py-3 font-medium text-stone-500 dark:text-zinc-400 sm:table-cell">
                    Target User
                  </th>
                  <th className="px-4 py-3 font-medium text-stone-500 dark:text-zinc-400">Discount</th>
                  <th className="hidden px-4 py-3 font-medium text-stone-500 dark:text-zinc-400 md:table-cell">
                    Duration
                  </th>
                  <th className="px-4 py-3 font-medium text-stone-500 dark:text-zinc-400">Status</th>
                  <th className="hidden px-4 py-3 font-medium text-stone-500 dark:text-zinc-400 lg:table-cell">
                    Issuer
                  </th>
                  <th className="px-4 py-3 font-medium text-stone-500 dark:text-zinc-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                {filteredCodes.map((code) => {
                  const statusCfg = STATUS_CONFIG[code.status];
                  const StatusIcon = statusCfg.icon;

                  return (
                    <tr
                      key={code.id}
                      className="transition-colors hover:bg-stone-50 dark:hover:bg-zinc-800/30"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-stone-900 dark:text-white">
                            {code.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(code.code, code.id)}
                            className="text-stone-400 hover:text-stone-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                          >
                            {copiedId === code.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        {code.note && (
                          <p className="mt-0.5 truncate text-xs text-stone-400 dark:text-zinc-500">
                            {code.note}
                          </p>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <span className="text-xs text-stone-600 dark:text-zinc-400">
                          {code.target_email}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-stone-900 dark:text-white">
                          {code.percent_off}%
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <span className="text-xs text-stone-600 dark:text-zinc-400">
                          {code.duration_months} {code.duration_months === 1 ? "month" : "months"}
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
                        <span className="text-xs text-stone-500 dark:text-zinc-400">
                          {code.issuer_email}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {code.status === "active" && (
                            <>
                              <button
                                type="button"
                                onClick={() => setApplyingCodeId(code.id)}
                                className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
                              >
                                Apply
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRevoke(code.id)}
                                className="rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                              >
                                Revoke
                              </button>
                            </>
                          )}
                          {code.status !== "active" && (
                            <span className="text-xs text-stone-400 dark:text-zinc-500">—</span>
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
      )}
    </div>
  );
}
