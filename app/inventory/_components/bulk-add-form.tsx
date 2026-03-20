"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Trash2,
  ImagePlus,
  ChevronDown,
  ChevronUp,
  Check,
  RefreshCw,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  createBulkInventoryItemsWithImages,
  analyzeItemAction,
  type UserProject,
} from "@/app/inventory/actions";
import { PageHeader } from "@/app/components/page-header";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const categories = [
  "Furniture", "Art", "Jewelry", "Electronics", "Antiques",
  "Collectibles", "Clothing", "Books", "Kitchenware", "Tools", "Other",
];
const conditions = ["Excellent", "Good", "Fair", "Poor"];

type BulkItem = {
  id: string;
  imageFile: File | null;
  imagePreview: string | null;
  expanded: boolean;
  name: string;
  description: string;
  category: string;
  condition: string;
  price: string;
  analysisStatus: 'none' | 'queued' | 'analyzing' | 'complete' | 'failed';
  analysisError?: string;
};

function newEmptyItem(): BulkItem {
  return {
    id: crypto.randomUUID(),
    imageFile: null,
    imagePreview: null,
    expanded: true,
    name: "",
    description: "",
    category: "Other",
    condition: "Good",
    price: "",
    analysisStatus: 'none',
  };
}

type BulkAddFormProps = Readonly<{
  projects: UserProject[];
  userId: string;
}>;

export function BulkAddForm({ projects, userId }: BulkAddFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<BulkItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [projectId, setProjectId] = useState("");

  async function analyzeItem(id: string, file: File) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, analysisStatus: "analyzing", analysisError: undefined } : it))
    );

    try {
      const formData = new FormData();
      formData.append("image", file);

      const result = await analyzeItemAction(formData);

      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== id) return it;

          if (result.error || !result.data) {
            return {
              ...it,
              analysisStatus: "failed",
              analysisError: result.error || "Analysis failed",
            };
          }

          const data = result.data;
          return {
            ...it,
            name: it.name || data.name,
            description: it.description || data.description,
            category: it.category === "Other" && data.category ? data.category : it.category,
            condition: it.condition === "Good" && data.condition ? data.condition : it.condition,
            price: !it.price && data.price ? data.price.toString() : it.price,
            analysisStatus: "complete",
          };
        })
      );
    } catch (err) {
      console.error("Analysis client error:", err);
      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? { ...it, analysisStatus: "failed", analysisError: "Network or server error" }
            : it
        )
      );
    }
  }

  function processFiles(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter(
      (f) => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024
    );
    if (!imageFiles.length) {
      setError("Please upload image files (JPG, PNG, WebP) under 10 MB.");
      return;
    }
    setError("");

    const newItems: BulkItem[] = imageFiles.map((file) => ({
      ...newEmptyItem(),
      imageFile: file,
      imagePreview: URL.createObjectURL(file),
      expanded: false,
      analysisStatus: "queued",
    }));

    setItems((prev) => [...prev, ...newItems]);

    // Trigger analysis for each new item with a stagger to avoid flooding the server
    newItems.forEach((item, index) => {
      setTimeout(() => {
        if (item.imageFile) analyzeItem(item.id, item.imageFile);
      }, 100 + (index * 800)); // 800ms stagger
    });
  }

  function retryAnalysis(id: string) {
    const item = items.find((it) => it.id === id);
    if (item?.imageFile) {
      analyzeItem(id, item.imageFile);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) processFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function updateItem(id: string, field: keyof BulkItem, value: string | boolean) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  }

  function toggleExpand(id: string) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, expanded: !it.expanded } : it))
    );
  }

  function addEmptyItem() {
    setItems((prev) => [...prev, newEmptyItem()]);
  }

  const canSubmit =
    items.length > 0 &&
    items.every(
      (it) =>
        it.name.trim() &&
        !isNaN(parseFloat(it.price)) &&
        parseFloat(it.price) >= 0
    );

  async function handleSubmit() {
    setError("");

    if (!projectId && !window.confirm("You have not selected a project. These items will be added without a project. Continue?")) {
      return;
    }

    setSubmitting(true);

    const formData = new FormData();

    const payload = items.map((it) => ({
      name: it.name.trim(),
      description: it.description.trim(),
      category: it.category,
      price: parseFloat(it.price) || 0,
      condition: it.condition,
      user_id: userId,
      project_id: projectId || undefined,
    }));

    formData.append("items", JSON.stringify(payload));

    items.forEach((item, i) => {
      if (item.imageFile) {
        formData.append(`image-${i}`, item.imageFile);
      }
    });

    const result = await createBulkInventoryItemsWithImages(formData);

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
        title="Bulk add items"
        description="Drop multiple images to add many items at once. AI will analyze each image in the background."
        backLink={{ href: "/inventory", label: "Back to inventory" }}
      />

      {/* Project picker */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.03 }}
        className="mt-6"
      >
        <label htmlFor="project_id" className="mb-1.5 block text-sm font-medium text-stone-900 dark:text-white">
          Project
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
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="block w-full max-w-sm rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm text-stone-900 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
          >
            <option value="">Select a project (optional)…</option>
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
      </motion.div>

      {/* Drop zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="mt-8"
      >
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 transition-all",
            dragging
              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10"
              : "border-stone-300 bg-white hover:border-indigo-400 hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-indigo-500 dark:hover:bg-zinc-800/50"
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 dark:bg-zinc-800">
            <ImagePlus className="h-6 w-6 text-stone-500 dark:text-zinc-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-stone-700 dark:text-zinc-300">
              Drop images here or click to browse
            </p>
            <p className="mt-1 text-xs text-stone-500 dark:text-zinc-500">
              JPG, PNG, WebP &middot; Up to 10 MB each &middot; optimized automatically
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </motion.div>

      {/* Status bar */}
      {items.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <p className="text-sm text-stone-600 dark:text-zinc-400">
            {items.length} {items.length === 1 ? "item" : "items"}
          </p>
          <button
            type="button"
            onClick={addEmptyItem}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            + Add manually
          </button>
        </motion.div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Item cards */}
      <div className="mt-4 space-y-3">
        <AnimatePresence mode="popLayout">
          {items.map((item, idx) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            >
              {/* Card header */}
              <div
                className="flex cursor-pointer items-center gap-3 px-4 py-3"
                onClick={() => toggleExpand(item.id)}
              >
                {item.imagePreview ? (
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                    <Image src={item.imagePreview} alt="" fill className="object-cover" />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 dark:bg-zinc-800">
                    <ImagePlus className="h-4 w-4 text-stone-400 dark:text-zinc-500" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-stone-900 dark:text-white">
                      {item.name || `Item ${idx + 1}`}
                    </p>
                    {(item.analysisStatus === 'queued' || item.analysisStatus === 'analyzing') && (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                        <Loader2 className="h-3 w-3 animate-spin" /> Analyzing
                      </span>
                    )}
                    {item.analysisStatus === 'failed' && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300" title={item.analysisError}>
                        Analysis failed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 dark:text-zinc-500">
                    {item.category} &middot; {item.condition}
                    {item.price && ` · $${item.price}`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {item.analysisStatus === 'failed' && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); retryAnalysis(item.id); }}
                      className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                      title="Retry AI Analysis"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                    className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {item.expanded ? (
                    <ChevronUp className="h-4 w-4 text-stone-400 dark:text-zinc-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-stone-400 dark:text-zinc-500" />
                  )}
                </div>
              </div>

              {/* Expanded form */}
              {item.expanded && (
                <div className="border-t border-stone-100 px-4 pb-4 pt-3 dark:border-zinc-800">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-stone-700 dark:text-zinc-300">Name *</label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(item.id, "name", e.target.value)}
                        placeholder="Item name"
                        className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 transition-colors focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500 dark:focus:border-indigo-500 dark:focus:bg-zinc-800"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-stone-700 dark:text-zinc-300">Description</label>
                      <textarea
                        value={item.description}
                        onChange={(e) => updateItem(item.id, "description", e.target.value)}
                        placeholder="Brief description"
                        rows={2}
                        className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 transition-colors focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500 dark:focus:border-indigo-500 dark:focus:bg-zinc-800"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-stone-700 dark:text-zinc-300">Category</label>
                      <select
                        value={item.category}
                        onChange={(e) => updateItem(item.id, "category", e.target.value)}
                        className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-900 transition-colors focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-indigo-500 dark:focus:bg-zinc-800"
                      >
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-stone-700 dark:text-zinc-300">Condition</label>
                      <select
                        value={item.condition}
                        onChange={(e) => updateItem(item.id, "condition", e.target.value)}
                        className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-900 transition-colors focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-indigo-500 dark:focus:bg-zinc-800"
                      >
                        {conditions.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-stone-700 dark:text-zinc-300">Price ($) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price}
                        onChange={(e) => updateItem(item.id, "price", e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 transition-colors focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500 dark:focus:border-indigo-500 dark:focus:bg-zinc-800"
                      />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Submit */}
      {items.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 flex justify-end gap-3"
        >
          <button
            type="button"
            onClick={() => setItems([])}
            className="rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Adding…</>
            ) : (
              <><Check className="h-4 w-4" /> Add {items.length} {items.length === 1 ? "item" : "items"}</>
            )}
          </button>
        </motion.div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-12 text-center">
          <p className="text-sm text-stone-500 dark:text-zinc-500">
            Drop images above to get started, or{" "}
            <button type="button" onClick={addEmptyItem} className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
              add items manually
            </button>.
          </p>
        </motion.div>
      )}
    </main>
  );
}
 
