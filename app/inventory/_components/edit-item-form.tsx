"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { PiSpinnerDuotone, PiSparkleDuotone, PiArrowsClockwiseDuotone, PiArrowClockwiseDuotone, PiImageDuotone } from "react-icons/pi";
import {
  INVENTORY_CATEGORIES,
  INVENTORY_CONDITIONS,
  isInventoryCategory,
  isInventoryCondition,
  type AIAnalysisResult,
} from "@/lib/inventory";
import { PageHeader } from "@/app/components/page-header";
import {
  updateInventoryItem,
  retryImageProcessing,
  type InventoryItem,
  type UserProject,
} from "@/app/inventory/actions";
const statuses = ["available", "reserved", "sold"] as const;

const inputClass =
  "block w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm text-stone-900 placeholder-stone-400 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:placeholder-stone-500";
const selectClass =
  "block w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm text-stone-900 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white";

type EditItemFormProps = Readonly<{
  item: InventoryItem;
  projects: UserProject[];
  userId: string;
}>;

export function EditItemForm({ item, projects, userId }: EditItemFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [aiApplied, setAiApplied] = useState(false);
  const [error, setError] = useState("");

  // Controlled fields so AI "Apply" can populate them
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [category, setCategory] = useState(item.category ?? "Other");
  const [condition, setCondition] = useState(item.condition ?? "Good");
  const [price, setPrice] = useState(String(item.price ?? ""));
  const [status, setStatus] = useState(item.status ?? "available");
  const [quantity, setQuantity] = useState(String(item.quantity ?? 1));
  const [projectId, setProjectId] = useState(item.project_id);

  const insights = item.ai_insights as AIAnalysisResult | null;

  function handleApplyAI() {
    if (!insights) return;
    if (insights.name) setName(insights.name);
    if (insights.description) setDescription(insights.description);
    if (insights.category && isInventoryCategory(insights.category)) setCategory(insights.category);
    if (insights.condition && isInventoryCondition(insights.condition)) setCondition(insights.condition);
    if (insights.price != null) setPrice(String(insights.price));
    setAiApplied(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const result = await updateInventoryItem(item.id, userId, formData);

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    } else {
      router.push("/inventory");
    }
  }

  async function handleRetryProcessing() {
    setRetrying(true);
    const result = await retryImageProcessing(item.id);
    if (result.error) {
      setError(result.error);
    }
    setRetrying(false);
    router.refresh();
  }

  const imageUrl = item.medium_image_url || item.original_image_url;

  return (
    <main className="mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <PageHeader
        title="Edit item"
        description={`Update the details for ${item.name}.`}
        backLink={{ href: "/inventory", label: "Back to inventory" }}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* ── Left column: image + AI action ── */}
        <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
          {/* Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 dark:border-zinc-800 dark:bg-zinc-950"
          >
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={item.name}
                width={600}
                height={600}
                className="aspect-square w-full h-auto object-contain"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center">
                <PiImageDuotone className="h-16 w-16 text-stone-300 dark:text-zinc-700" />
              </div>
            )}
          </motion.div>

          {/* Processing status overlay */}
          {item.processing_status === "failed" && item.original_image_url && (
            <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/40">
              <p className="text-sm text-red-600 dark:text-red-400">Processing failed</p>
              <button
                type="button"
                onClick={handleRetryProcessing}
                disabled={retrying}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {retrying ? <PiSpinnerDuotone className="h-3.5 w-3.5 animate-spin" /> : <PiArrowsClockwiseDuotone className="h-3.5 w-3.5" />}
                Retry
              </button>
            </div>
          )}

          {(item.processing_status === "queued" || item.processing_status === "processing" || item.processing_status === "analyzing") && (
            <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-800/40 dark:bg-indigo-950/30">
              <PiSpinnerDuotone className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                {item.processing_status === "queued" ? "Queued…" : item.processing_status === "analyzing" ? "Analyzing…" : "Processing…"}
              </p>
            </div>
          )}

          {/* AI suggestions — compact action bar */}
          {insights && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-800/40 dark:bg-indigo-950/30"
            >
              <div className="flex items-center gap-2 min-w-0">
                <PiSparkleDuotone className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                <span className="truncate text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  {aiApplied ? "AI suggestions applied" : "AI suggestions available"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleApplyAI}
                className="ml-3 inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
              >
                {aiApplied ? (
                  <>
                    <PiArrowClockwiseDuotone className="h-3.5 w-3.5" />
                    Re-apply
                  </>
                ) : (
                  "Apply"
                )}
              </button>
            </motion.div>
          )}
        </div>

        {/* ── Right column: form ── */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="space-y-5"
        >
          {/* Project */}
          <div>
            <label htmlFor="project_id" className="mb-1.5 block text-sm font-medium text-stone-900 dark:text-white">
              Project <span className="text-red-500">*</span>
            </label>
            <select
              id="project_id"
              name="project_id"
              required
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={selectClass}
            >
              <option value="">Select a project…</option>
              {Object.entries(
                projects.reduce<Record<string, UserProject[]>>((acc, p) => {
                  (acc[p.org_name] ??= []).push(p);
                  return acc;
                }, {})
              ).map(([orgName, orgProjects]) => (
                <optgroup key={orgName} label={orgName}>
                  {orgProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-stone-900 dark:text-white">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-stone-900 dark:text-white">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Category + Condition */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-stone-900 dark:text-white">Category</label>
              <select id="category" name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
                {INVENTORY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="condition" className="mb-1.5 block text-sm font-medium text-stone-900 dark:text-white">Condition</label>
              <select id="condition" name="condition" value={condition} onChange={(e) => setCondition(e.target.value)} className={selectClass}>
                {INVENTORY_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Price + Quantity + Status */}
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label htmlFor="price" className="mb-1.5 block text-sm font-medium text-stone-900 dark:text-white">
                Price ($) <span className="text-red-500">*</span>
              </label>
              <input
                id="price"
                name="price"
                type="number"
                min="0"
                step="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="quantity" className="mb-1.5 block text-sm font-medium text-stone-900 dark:text-white">Quantity</label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="status" className="mb-1.5 block text-sm font-medium text-stone-900 dark:text-white">Status</label>
              <select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={selectClass}>
                {statuses.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {error && (
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </motion.p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-xl border border-transparent bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-lg transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <PiSpinnerDuotone className="h-4 w-4 animate-spin" /> : "Save changes"}
            </button>
            <Link href="/inventory" className="text-sm font-medium text-stone-500 transition-colors hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white">
              Cancel
            </Link>
          </div>
        </motion.form>
      </div>
    </main>
  );
}
