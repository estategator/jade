"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  PiSpinnerDuotone,
  PiTrashDuotone,
  PiImageDuotone,
  PiCaretDownDuotone,
  PiCaretUpDuotone,
  PiCheckDuotone,
  PiArrowsClockwiseDuotone,
  PiWarningDuotone,
  PiCheckCircleDuotone,
  PiXCircleDuotone,
} from "react-icons/pi";

type UploadPhase = 'idle' | 'preparing' | 'uploading' | 'finalizing' | 'complete' | 'error';

type UploadProgress = {
  phase: UploadPhase;
  totalUploads: number;
  completedUploads: number;
  failedUploads: number;
};
import { cn } from "@/lib/cn";
import { INVENTORY_CATEGORIES, INVENTORY_CONDITIONS, type AIAnalysisResult } from "@/lib/inventory";
import {
  prepareBulkInventoryItems,
  finalizeBulkUploads,
  type UserProject,
} from "@/app/inventory/actions";
import { PageHeader } from "@/app/components/page-header";
import { compressImage, getAdaptiveConcurrency, pooledMap } from "@/lib/client-image-compress";

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
  aiInsights?: AIAnalysisResult | null;
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

  // ── Upload lifecycle state ──
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    phase: 'idle',
    totalUploads: 0,
    completedUploads: 0,
    failedUploads: 0,
  });

  const uploadActive = uploadProgress.phase !== 'idle' && uploadProgress.phase !== 'complete' && uploadProgress.phase !== 'error';
  const showOverlay = uploadProgress.phase !== 'idle';
  const uploadPercent = uploadProgress.totalUploads > 0
    ? Math.round(((uploadProgress.completedUploads + uploadProgress.failedUploads) / uploadProgress.totalUploads) * 100)
    : 0;

  const handleGoToInventory = useCallback(() => {
    router.push('/inventory');
  }, [router]);

  // ── Browser unload warning while upload is in flight ──
  useEffect(() => {
    if (!uploadActive) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [uploadActive]);

  // Per-item analysis generation tokens: only the latest request for a given
  // item id can write back results. Prevents stale/duplicate overwrites.
  const analysisTokensRef = useRef<Map<string, number>>(new Map());
  // Global generation: bumped on submit to invalidate all pending analyses.
  const analysisGenerationRef = useRef(0);

  async function analyzeItem(id: string, file: File) {
    // Bump per-item token so any prior in-flight request for this item is stale.
    const gen = analysisGenerationRef.current;
    const prevToken = analysisTokensRef.current.get(id) ?? 0;
    const token = prevToken + 1;
    analysisTokensRef.current.set(id, token);

    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, analysisStatus: "analyzing", analysisError: undefined } : it))
    );

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/inventory/analyze", {
        method: "POST",
        body: formData,
      });

      const result = await res.json() as { success?: boolean; data?: AIAnalysisResult; error?: string };

      // Guard: discard if a newer request was issued for this item,
      // the item was removed, or a submit invalidated all analyses.
      if (
        analysisTokensRef.current.get(id) !== token ||
        analysisGenerationRef.current !== gen
      ) {
        return;
      }

      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== id) return it;

          if (!res.ok || result.error || !result.data) {
            return {
              ...it,
              aiInsights: null,
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
            aiInsights: data,
            analysisStatus: "complete",
          };
        })
      );
    } catch (analysisError) {
      console.error("Analysis client error:", analysisError);
      // Guard stale responses on error path too.
      if (
        analysisTokensRef.current.get(id) !== token ||
        analysisGenerationRef.current !== gen
      ) {
        return;
      }
      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? { ...it, aiInsights: null, analysisStatus: "failed", analysisError: "Network or server error" }
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
      analysisStatus: "analyzing" as const,
    }));

    setItems((prev) => [...prev, ...newItems]);

    // Dispatch analyses with bounded concurrency to avoid rate-limit cascades
    const analysisConcurrency = Math.min(3, getAdaptiveConcurrency());
    const analysisTasks = newItems.map((item) => () => analyzeItem(item.id, item.imageFile!));
    pooledMap(analysisTasks, analysisConcurrency);
  }

  function retryAnalysis(id: string) {
    const item = items.find((candidate) => candidate.id === id);
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
    // Invalidate pending analysis for this item so late responses are discarded.
    analysisTokensRef.current.delete(id);
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

  const imageItems = items.filter((item) => item.imageFile);
  const analysisCounts = imageItems.reduce(
    (counts, item) => {
      if (item.analysisStatus === "complete") counts.complete += 1;
      if (item.analysisStatus === "failed") counts.failed += 1;
      if (item.analysisStatus === "analyzing") counts.analyzing += 1;
      if (item.analysisStatus === "queued") counts.queued += 1;
      return counts;
    },
    { complete: 0, failed: 0, analyzing: 0, queued: 0 }
  );
  const analyzedImageCount = analysisCounts.complete + analysisCounts.failed;
  const analysisProgressPercent = imageItems.length > 0
    ? Math.round((analyzedImageCount / imageItems.length) * 100)
    : 0;
  const analysisInProgress = imageItems.some(
    (item) => item.analysisStatus === "queued" || item.analysisStatus === "analyzing"
  );

  const canSubmit =
    items.length > 0 &&
    items.every(
      (it) =>
        (it.name.trim() && !isNaN(parseFloat(it.price)) && parseFloat(it.price) >= 0)
    );

  async function handleSubmit() {
    setError("");

    if (!projectId && !window.confirm("You have not selected a project. These items will be added without a project. Continue?")) {
      return;
    }

    setSubmitting(true);

    // Invalidate all pending analyses so late responses don't mutate state.
    analysisGenerationRef.current++;

    // ── Snapshot: freeze items at submit time so mutations can't corrupt mapping ──
    const snapshot = [...items];

    try {
      const payload = snapshot.map((it) => ({
        name: it.name.trim(),
        description: it.description.trim(),
        category: it.category,
        price: parseFloat(it.price) || 0,
        condition: it.condition,
        ai_insights: it.aiInsights ?? null,
        user_id: userId,
        project_id: projectId || undefined,
      }));

      const imageIndexes = snapshot
        .map((it, i) => (it.imageFile ? i : -1))
        .filter((i) => i !== -1);

      // Phase: preparing
      setUploadProgress({ phase: 'preparing', totalUploads: imageIndexes.length, completedUploads: 0, failedUploads: 0 });

      // 1. Prepare: insert all rows + get signed upload URLs
      const prepResult = await prepareBulkInventoryItems({
        items: payload,
        imageIndexes,
      });

      if (prepResult.error || !prepResult.data) {
        setError(prepResult.error || "Failed to prepare items.");
        setUploadProgress({ phase: 'error', totalUploads: 0, completedUploads: 0, failedUploads: 0 });
        setSubmitting(false);
        return;
      }

      const { itemIds, uploads } = prepResult.data;

      // ── Build deterministic itemId → file map from snapshot ──
      const itemIdToFile = new Map<string, { file: File; hasAi: boolean }>();
      for (let i = 0; i < snapshot.length; i++) {
        if (snapshot[i].imageFile) {
          itemIdToFile.set(itemIds[i], {
            file: snapshot[i].imageFile!,
            hasAi: !!(snapshot[i].aiInsights),
          });
        }
      }

      // 2. Compress + direct-upload with adaptive concurrency
      if (uploads.length > 0) {
        // Phase: uploading
        setUploadProgress({ phase: 'uploading', totalUploads: uploads.length, completedUploads: 0, failedUploads: 0 });

        const concurrency = getAdaptiveConcurrency();
        const succeeded: { itemId: string; storagePath: string; skipAnalysis: boolean }[] = [];
        const failedItemIds: string[] = [];

        const tasks = uploads.map((upload) => async () => {
          const entry = itemIdToFile.get(upload.itemId);
          if (!entry) {
            failedItemIds.push(upload.itemId);
            setUploadProgress((prev) => ({ ...prev, failedUploads: prev.failedUploads + 1 }));
            return;
          }

          try {
            const { blob } = await compressImage(entry.file);
            const res = await fetch(upload.signedUrl, {
              method: "PUT",
              headers: { "Content-Type": "image/webp" },
              body: blob,
            });

            if (res.ok) {
              succeeded.push({
                itemId: upload.itemId,
                storagePath: upload.storagePath,
                skipAnalysis: entry.hasAi,
              });
              setUploadProgress((prev) => ({ ...prev, completedUploads: prev.completedUploads + 1 }));
            } else {
              console.error("Direct upload failed:", upload.itemId, res.status);
              failedItemIds.push(upload.itemId);
              setUploadProgress((prev) => ({ ...prev, failedUploads: prev.failedUploads + 1 }));
            }
          } catch (err) {
            console.error("Upload error:", upload.itemId, err);
            failedItemIds.push(upload.itemId);
            setUploadProgress((prev) => ({ ...prev, failedUploads: prev.failedUploads + 1 }));
          }
        });

        await pooledMap(tasks, concurrency);

        // Phase: finalizing
        setUploadProgress((prev) => ({ ...prev, phase: 'finalizing' }));

        // 3. Finalize: enqueue processing for successful uploads
        const finalizeResult = await finalizeBulkUploads({ succeeded, failedItemIds });
        if (finalizeResult.error) {
          console.error("Finalize error:", finalizeResult.error);
        }

        // Resolve to completion or error
        if (failedItemIds.length > 0 && succeeded.length === 0) {
          setUploadProgress((prev) => ({ ...prev, phase: 'error' }));
          setError("All uploads failed. Your items were saved but images could not be uploaded.");
        } else {
          setUploadProgress((prev) => ({ ...prev, phase: 'complete' }));
        }
      } else {
        // No images to upload — go straight to complete
        setUploadProgress({ phase: 'complete', totalUploads: 0, completedUploads: 0, failedUploads: 0 });
      }
    } catch (err) {
      console.error("Bulk submit error:", err);
      setError("An unexpected error occurred.");
      setUploadProgress((prev) => ({ ...prev, phase: 'error' }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Bulk add items"
        description="Select images, review AI suggestions, then upload. You don't need to wait for analysis to finish."
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
            <PiImageDuotone className="h-6 w-6 text-stone-500 dark:text-zinc-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-stone-700 dark:text-zinc-300">
              Drop images here or click to browse
            </p>
            <p className="mt-1 text-xs text-stone-500 dark:text-zinc-500">
              Add as many JPG, PNG, or WebP images as you need &middot; 10 MB max each
            </p>
            <p className="mt-2 text-xs text-indigo-600 dark:text-indigo-400">
              AI analysis runs in the background &mdash; you can upload before it finishes.
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
          className="mt-6 rounded-xl border border-stone-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-stone-600 dark:text-zinc-400">
                {items.length} {items.length === 1 ? "item" : "items"}
                {imageItems.length > 0 && ` · ${imageItems.length} ${imageItems.length === 1 ? "image" : "images"} in analysis queue`}
              </p>
              {imageItems.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500 dark:text-zinc-500">
                    <span>{analyzedImageCount} / {imageItems.length} analyzed</span>
                    {analysisCounts.analyzing > 0 && <span>{analysisCounts.analyzing} analyzing</span>}
                    {analysisCounts.failed > 0 && <span>{analysisCounts.failed} need attention</span>}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-[width] duration-300"
                      style={{ width: `${analysisProgressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={addEmptyItem}
              className="shrink-0 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              + Add manually
            </button>
          </div>
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
                    <PiImageDuotone className="h-4 w-4 text-stone-400 dark:text-zinc-500" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-stone-900 dark:text-white">
                      {item.name || `Item ${idx + 1}`}
                    </p>
                    {(item.analysisStatus === 'queued' || item.analysisStatus === 'analyzing') && (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                        <PiSpinnerDuotone className="h-3 w-3 animate-spin" /> Analyzing
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
                      <PiArrowsClockwiseDuotone className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                    className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  >
                    <PiTrashDuotone className="h-4 w-4" />
                  </button>
                  {item.expanded ? (
                    <PiCaretUpDuotone className="h-4 w-4 text-stone-400 dark:text-zinc-500" />
                  ) : (
                    <PiCaretDownDuotone className="h-4 w-4 text-stone-400 dark:text-zinc-500" />
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
                        {INVENTORY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-stone-700 dark:text-zinc-300">Condition</label>
                      <select
                        value={item.condition}
                        onChange={(e) => updateItem(item.id, "condition", e.target.value)}
                        className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-900 transition-colors focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-indigo-500 dark:focus:bg-zinc-800"
                      >
                        {INVENTORY_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
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
              <><PiSpinnerDuotone className="h-4 w-4 animate-spin" /> Adding…</>
            ) : (
              <><PiCheckDuotone className="h-4 w-4" /> Upload {items.length} {items.length === 1 ? "item" : "items"}{analysisInProgress ? " (analysis still running)" : ""}</>
            )}
          </button>
        </motion.div>
      )}

      {/* Empty state */}
      {items.length === 0 && uploadProgress.phase === 'idle' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-12 text-center">
          <p className="text-sm text-stone-500 dark:text-zinc-500">
            Drop images above to get started, or{" "}
            <button type="button" onClick={addEmptyItem} className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
              add items manually
            </button>.
          </p>
        </motion.div>
      )}

      {/* ── Upload progress overlay ── */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Upload progress"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
            >
              {/* ── Active upload phases: preparing / uploading / finalizing ── */}
              {uploadActive && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/20">
                      <PiSpinnerDuotone className="h-5 w-5 animate-spin text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                        {uploadProgress.phase === 'preparing' && 'Preparing items…'}
                        {uploadProgress.phase === 'uploading' && 'Uploading images…'}
                        {uploadProgress.phase === 'finalizing' && 'Finalizing…'}
                      </h2>
                      <p className="text-sm text-stone-500 dark:text-zinc-400">
                        {uploadProgress.phase === 'preparing' && 'Creating inventory records and generating upload URLs.'}
                        {uploadProgress.phase === 'uploading' && `${uploadProgress.completedUploads} of ${uploadProgress.totalUploads} images uploaded`}
                        {uploadProgress.phase === 'finalizing' && 'Processing uploaded images. Almost done.'}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar (visible during uploading) */}
                  {uploadProgress.phase === 'uploading' && uploadProgress.totalUploads > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-stone-500 dark:text-zinc-500">
                        <span>{uploadPercent}%</span>
                        {uploadProgress.failedUploads > 0 && (
                          <span className="text-red-600 dark:text-red-400">{uploadProgress.failedUploads} failed</span>
                        )}
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-stone-100 dark:bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-indigo-500 transition-[width] duration-300"
                          style={{ width: `${uploadPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Warning banner */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/30">
                    <div className="flex gap-2">
                      <PiWarningDuotone className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        <strong>Do not close or refresh this tab.</strong> Closing now may interrupt the upload and you may need to re-add these items.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Complete state ── */}
              {uploadProgress.phase === 'complete' && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                      <PiCheckCircleDuotone className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                        {uploadProgress.failedUploads > 0 ? 'Upload partially complete' : 'Upload complete'}
                      </h2>
                      <p className="text-sm text-stone-500 dark:text-zinc-400">
                        {uploadProgress.failedUploads > 0
                          ? `${uploadProgress.completedUploads} of ${uploadProgress.totalUploads} images uploaded successfully. ${uploadProgress.failedUploads} failed — those items were saved without images.`
                          : uploadProgress.totalUploads > 0
                            ? `All ${uploadProgress.totalUploads} images uploaded successfully.`
                            : 'All items have been added to your inventory.'}
                      </p>
                    </div>
                  </div>

                  {uploadProgress.failedUploads > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/30">
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Items with failed uploads were saved without images. You can re-upload images from the inventory detail page.
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleGoToInventory}
                    className="w-full rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    Go to inventory
                  </button>
                </div>
              )}

              {/* ── Error state ── */}
              {uploadProgress.phase === 'error' && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20">
                      <PiXCircleDuotone className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-stone-900 dark:text-white">Upload failed</h2>
                      <p className="text-sm text-stone-500 dark:text-zinc-400">
                        {error || 'Something went wrong during the upload. Your items may have been partially saved.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleGoToInventory}
                      className="flex-1 rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Go to inventory
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadProgress({ phase: 'idle', totalUploads: 0, completedUploads: 0, failedUploads: 0 })}
                      className="flex-1 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
 
