"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  PiCalendarDuotone,
  PiFunnelDuotone,
  PiSpinnerDuotone,
  PiFileTextDuotone,
} from "react-icons/pi";
import { generateInvoice, getOrgProjects, getOrgCategories } from "@/app/invoices/actions";

type Props = {
  userId: string;
  orgId: string;
  onGenerated?: () => void;
};

export function InvoiceGenerateForm({ userId, orgId, onGenerated }: Props) {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [projectId, setProjectId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [category, setCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState("completed");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadFilters() {
      const [projResult, catResult] = await Promise.all([
        getOrgProjects(userId, orgId),
        getOrgCategories(userId, orgId),
      ]);
      if (cancelled) return;
      if (projResult.data) setProjects(projResult.data);
      if (catResult.data) setCategories(catResult.data);
    }
    loadFilters();
    return () => { cancelled = true; };
  }, [userId, orgId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const formData = new FormData();
    formData.set("user_id", userId);
    formData.set("org_id", orgId);
    formData.set("period_start", periodStart);
    formData.set("period_end", periodEnd);
    formData.set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (projectId) formData.set("project_id", projectId);
    if (category) formData.set("category", category);
    if (statusFilter) formData.set("status_filter", statusFilter);
    if (minPrice) formData.set("min_price", minPrice);
    if (maxPrice) formData.set("max_price", maxPrice);
    if (notes) formData.set("notes", notes);

    const result = await generateInvoice(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setSuccess(`Invoice ${result.data.invoice_number} created with ${result.data.line_count} line items.`);
      // Reset form
      setProjectId("");
      setPeriodStart("");
      setPeriodEnd("");
      setCategory("");
      setMinPrice("");
      setMaxPrice("");
      setNotes("");
      onGenerated?.();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
          <PiFileTextDuotone className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-stone-900 dark:text-white">Generate Invoice</h2>
          <p className="text-sm text-stone-500 dark:text-zinc-400">Create an invoice from your sales data</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Date range */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="period_start" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
              <PiCalendarDuotone className="mr-1 inline h-4 w-4" />
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              id="period_start"
              type="date"
              required
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-indigo-400"
            />
          </div>
          <div>
            <label htmlFor="period_end" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
              <PiCalendarDuotone className="mr-1 inline h-4 w-4" />
              End Date <span className="text-red-500">*</span>
            </label>
            <input
              id="period_end"
              type="date"
              required
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-indigo-400"
            />
          </div>
        </div>

        {/* Project + Category */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="project_id" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
              Project
            </label>
            <select
              id="project_id"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-indigo-400"
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="status_filter" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
              Sale Status
            </label>
            <select
              id="status_filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-indigo-400"
            >
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="refunded">Refunded</option>
              <option value="">All statuses</option>
            </select>
          </div>
        </div>

        {/* Advanced filters toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          <PiFunnelDuotone className="h-4 w-4" />
          {showAdvanced ? "Hide" : "Show"} advanced filters
        </button>

        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-indigo-400"
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="min_price" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
                  Min Price ($)
                </label>
                <input
                  id="min_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-indigo-400"
                />
              </div>
              <div>
                <label htmlFor="max_price" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
                  Max Price ($)
                </label>
                <input
                  id="max_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="No limit"
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-indigo-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
                Notes
              </label>
              <textarea
                id="notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes for this invoice..."
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-indigo-400"
              />
            </div>
          </motion.div>
        )}

        {/* Error / Success messages */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-400">
            {success}
          </div>
        )}

        {/* Submit */}
        <div className="pt-2 border-t border-stone-200 dark:border-zinc-800">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600 dark:focus-visible:ring-offset-zinc-900 sm:w-auto"
          >
          {loading ? (
            <PiSpinnerDuotone className="h-4 w-4 animate-spin" />
          ) : (
            <PiFileTextDuotone className="h-4 w-4" />
          )}
          {loading ? "Generating…" : "Generate Invoice"}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
