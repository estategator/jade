"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Loader2, Upload, X, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/app/components/page-header";
import {
  createInventoryItem,
  analyzeItemAction,
  type UserProject,
  type AIAnalysisResult,
} from "@/app/inventory/actions";

const categories = [
  "Furniture", "Art", "Jewelry", "Electronics", "Antiques",
  "Collectibles", "Clothing", "Books", "Kitchenware", "Tools", "Other",
];
const conditions = ["Excellent", "Good", "Fair", "Poor"];

const inputClass =
  "block w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm text-stone-900 placeholder-stone-400 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:placeholder-stone-500";
const selectClass =
  "block w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm text-stone-900 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white";

type AddItemFormProps = Readonly<{
  projects: UserProject[];
  userId: string;
}>;

export function AddItemForm({ projects, userId }: AddItemFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [insights, setInsights] = useState<AIAnalysisResult | null>(null);
  const [aiApplied, setAiApplied] = useState(false);

  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Other");
  const [condition, setCondition] = useState("Good");
  const [price, setPrice] = useState("");

  function processFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be under 10 MB.");
      return;
    }
    setError("");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setInsights(null);
    setAiApplied(false);

    // Trigger AI analysis in the background
    setAnalyzing(true);
    const fd = new FormData();
    fd.append("image", file);
    analyzeItemAction(fd).then((result) => {
      if (result.success && result.data) {
        setInsights(result.data as AIAnalysisResult);
      }
      setAnalyzing(false);
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    setInsights(null);
    setAiApplied(false);
    setAnalyzing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleApplyAI() {
    if (!insights) return;
    if (insights.name) setName(insights.name);
    if (insights.description) setDescription(insights.description);
    if (insights.category && categories.includes(insights.category)) setCategory(insights.category);
    if (insights.condition && conditions.includes(insights.condition)) setCondition(insights.condition);
    if (insights.price != null) setPrice(String(insights.price));
    setAiApplied(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("category", category);
    formData.append("condition", condition);
    formData.append("price", price);
    formData.append("user_id", userId);
    formData.append("project_id", projectId);
    if (imageFile) {
      formData.append("image", imageFile);
    }

    const result = await createInventoryItem(formData);

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    } else {
      router.push("/inventory");
    }
  }

  return (
    <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Add item"
        description="Upload an image and we'll optimize it and generate AI insights in the background."
        backLink={{ href: "/inventory", label: "Back to inventory" }}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* ── Left column: image upload ── */}
        <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 dark:border-zinc-800 dark:bg-zinc-950"
          >
            {imagePreview ? (
              <div className="relative">
                <Image
                  src={imagePreview}
                  alt="Item preview"
                  width={600}
                  height={600}
                  className="aspect-square w-full object-contain"
                />
                <div className="absolute right-2 top-2">
                  <button
                    type="button"
                    onClick={removeImage}
                    className="rounded-lg bg-stone-900/70 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-stone-900"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={cn(
                  "flex aspect-square cursor-pointer flex-col items-center justify-center border-2 border-dashed transition-all",
                  dragging
                    ? "border-indigo-400 bg-indigo-50/50 dark:border-indigo-600 dark:bg-indigo-900/10"
                    : "border-stone-300 bg-white hover:border-indigo-300 hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-indigo-800 dark:hover:bg-zinc-800/50"
                )}
              >
                <Upload className="mb-3 h-8 w-8 text-stone-400 dark:text-zinc-500" />
                <p className="text-sm font-medium text-stone-900 dark:text-white">
                  Click or drag an image
                </p>
                <p className="mt-1 text-xs text-stone-500 dark:text-zinc-500">
                  JPG, PNG, or WebP up to 10 MB
                </p>
                <p className="mt-3 text-xs text-indigo-600 dark:text-indigo-400">
                  AI insights generated after upload
                </p>
              </div>
            )}
          </motion.div>

          {imagePreview && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Replace image
            </button>
          )}

          {/* AI analysis status */}
          {analyzing && (
            <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-800/40 dark:bg-indigo-950/30">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />
              <span className="text-sm text-indigo-700 dark:text-indigo-300">Analyzing image…</span>
            </div>
          )}

          {insights && !analyzing && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-800/40 dark:bg-indigo-950/30"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                <span className="truncate text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  AI suggestions available
                </span>
              </div>
              <button
                type="button"
                onClick={handleApplyAI}
                disabled={aiApplied}
                className="ml-3 inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
              >
                {aiApplied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Applied
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
            {projects.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-400">
                You don&apos;t belong to any projects yet.{" "}
                <Link href="/organizations" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                  Create or join an organization
                </Link>{" "}
                to get started.
              </div>
            ) : (
              <select
                id="project_id"
                name="project_id"
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className={selectClass}
              >
                <option value="">Select a project...</option>
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
            )}
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
              placeholder="e.g. Vintage Ceramic Vase"
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
              placeholder="Brief description of the item..."
              className={inputClass}
            />
          </div>

          {/* Category + Condition */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-stone-900 dark:text-white">Category</label>
              <select id="category" name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="condition" className="mb-1.5 block text-sm font-medium text-stone-900 dark:text-white">Condition</label>
              <select id="condition" name="condition" value={condition} onChange={(e) => setCondition(e.target.value)} className={selectClass}>
                {conditions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Price */}
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
              placeholder="0.00"
              className={inputClass}
            />
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
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add item"}
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
