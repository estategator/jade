"use client";

import { useState, useRef, useCallback, startTransition } from "react";
import { addTransitionType } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { PiSpinnerDuotone, PiUploadDuotone, PiCameraDuotone, PiXDuotone, PiSparkleDuotone, PiCheckDuotone, PiArrowClockwiseDuotone } from "react-icons/pi";
import { cn } from "@/lib/cn";
import {
  INVENTORY_CATEGORIES,
  INVENTORY_CONDITIONS,
  isInventoryCategory,
  isInventoryCondition,
  type AIAnalysisResult,
} from "@/lib/inventory";
import { PageHeader } from "@/app/components/page-header";
import {
  prepareInventoryItem,
  finalizeInventoryUpload,
  type UserProject,
} from "@/app/inventory/actions";
import { compressImage } from "@/lib/client-image-compress";

const FIELD_DEFAULTS = {
  name: "",
  description: "",
  category: "Other",
  condition: "Good",
  price: "",
} as const;

type SubmitState = "idle" | "submitting" | "success" | "error";

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
  // Tracks which analysis request is current; stale responses are discarded
  const analysisTokenRef = useRef(0);
  // Ref mirror of dirty fields — always current, safe to read in async callbacks
  const dirtyFieldsRef = useRef<Set<string>>(new Set());

  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [error, setError] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [insights, setInsights] = useState<AIAnalysisResult | null>(null);
  const [aiApplied, setAiApplied] = useState(false);

  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState<string>(FIELD_DEFAULTS.name);
  const [description, setDescription] = useState<string>(FIELD_DEFAULTS.description);
  const [category, setCategory] = useState<string>(FIELD_DEFAULTS.category);
  const [condition, setCondition] = useState<string>(FIELD_DEFAULTS.condition);
  const [price, setPrice] = useState<string>(FIELD_DEFAULTS.price);
  const [quantity, setQuantity] = useState<string>("1");

  const markDirty = useCallback((field: string) => {
    dirtyFieldsRef.current = new Set(dirtyFieldsRef.current).add(field);
    console.log("[AddItemForm] field marked dirty:", field, [...dirtyFieldsRef.current]);
  }, []);

  /** Apply AI data to form fields. When `onlyClean` is true, skip user-edited fields. */
  function applyAIFields(data: AIAnalysisResult, onlyClean: boolean) {
    const dirty = dirtyFieldsRef.current;
    console.log("[AddItemForm] applyAIFields", { onlyClean, dirty: [...dirty], data });

    if (data.name && (!onlyClean || !dirty.has("name"))) {
      console.log("[AddItemForm]  → setName:", data.name);
      setName(data.name);
    }
    if (data.description && (!onlyClean || !dirty.has("description"))) {
      console.log("[AddItemForm]  → setDescription:", data.description.slice(0, 60));
      setDescription(data.description);
    }
    if (data.category && isInventoryCategory(data.category) && (!onlyClean || !dirty.has("category"))) {
      console.log("[AddItemForm]  → setCategory:", data.category);
      setCategory(data.category);
    }
    if (data.condition && isInventoryCondition(data.condition) && (!onlyClean || !dirty.has("condition"))) {
      console.log("[AddItemForm]  → setCondition:", data.condition);
      setCondition(data.condition);
    }
    if (data.price != null && (!onlyClean || !dirty.has("price"))) {
      console.log("[AddItemForm]  → setPrice:", data.price);
      setPrice(String(data.price));
    }
  }

  /** Manual re-apply: overwrite all AI-supported fields regardless of dirty state. */
  function handleApplyAI() {
    console.log("[AddItemForm] handleApplyAI called, insights:", insights);
    if (!insights) return;
    applyAIFields(insights, false);
    setAiApplied(true);
  }

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
    // Reset AI lifecycle for new image
    setInsights(null);
    setAiApplied(false);

    // Bump token so any in-flight response for a previous image is discarded
    const token = ++analysisTokenRef.current;
    console.log("[AddItemForm] processFile: starting analysis, token =", token);

    setAnalyzing(true);
    const fd = new FormData();
    fd.append("image", file);
    fetch("/api/inventory/analyze", {
      method: "POST",
      body: fd,
    })
      .then(async (res) => {
        const result = await res.json() as { success?: boolean; data?: AIAnalysisResult; error?: string };
        console.log("[AddItemForm] analyze result:", JSON.stringify(result).slice(0, 300));

        // Guard: discard if a newer upload has started
        if (token !== analysisTokenRef.current) {
          console.log("[AddItemForm] stale token, discarding", { token, current: analysisTokenRef.current });
          return;
        }

        if (res.ok && result.success && result.data) {
          const data = result.data as AIAnalysisResult;
          const hasUsefulData = !!(data.name || data.description || (data.price && data.price > 0));
          console.log("[AddItemForm] analysis succeeded, hasUsefulData:", hasUsefulData);
          setInsights(data);
          if (hasUsefulData) {
            // Auto-apply to untouched fields only
            applyAIFields(data, true);
            setAiApplied(true);
          }
        } else {
          console.warn("[AddItemForm] analysis returned no data or error:", result);
        }
        setAnalyzing(false);
      })
      .catch((err) => {
        console.error("[AddItemForm] analyze fetch threw:", err);
        if (token === analysisTokenRef.current) {
          setAnalyzing(false);
        }
      });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Remove capture attribute after selection so it doesn't persist
    fileInputRef.current?.removeAttribute("capture");
  }

  function openFilePicker() {
    if (!fileInputRef.current) return;
    fileInputRef.current.removeAttribute("capture");
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  }

  function openCamera() {
    if (!fileInputRef.current) return;
    fileInputRef.current.setAttribute("capture", "environment");
    fileInputRef.current.value = "";
    fileInputRef.current.click();
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
    // Invalidate any in-flight analysis
    analysisTokenRef.current++;
    dirtyFieldsRef.current = new Set();
    if (fileInputRef.current) fileInputRef.current.value = "";
    console.log("[AddItemForm] removeImage: AI state reset");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitState("submitting");

    try {
      // 1. Prepare: insert DB row + get signed upload URL
      const prepResult = await prepareInventoryItem({
        name,
        description,
        category,
        price: parseFloat(price) || 0,
        condition,
        quantity: parseInt(quantity, 10) || 1,
        userId,
        projectId,
        hasImage: !!imageFile,
        aiInsights: insights ?? undefined,
      });

      if (prepResult.error || !prepResult.data) {
        setError(prepResult.error || "Failed to prepare item.");
        setSubmitState("error");
        return;
      }

      const { itemId, upload } = prepResult.data;

      // Navigate optimistically — the item row already exists
      setSubmitState("success");
      startTransition(() => {
        addTransitionType('nav-back');
        router.push("/inventory");
      });

      // 2. Compress + direct-upload + finalize in the background
      if (upload && imageFile) {
        (async () => {
          try {
            const { blob } = await compressImage(imageFile);
            const res = await fetch(upload.signedUrl, {
              method: "PUT",
              headers: { "Content-Type": "image/webp" },
              body: blob,
            });
            if (res.ok) {
              await finalizeInventoryUpload({
                itemId: upload.itemId,
                storagePath: upload.storagePath,
                skipAnalysis: !!insights,
              });
            } else {
              console.error("Direct upload failed:", res.status, await res.text());
            }
          } catch (err) {
            console.error("Background upload error:", err);
          }
        })();
      }
    } catch (err) {
      console.error("Submit error:", err);
      setError("An unexpected error occurred.");
      setSubmitState("error");
    }
  }

  const isBusy = submitState === "submitting" || submitState === "success";

  return (
    <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Add item"
        description="Upload an image and we'll optimize it and generate AI insights in the background."
        backLink={{ href: "/inventory", label: "Back to inventory", transitionTypes: ['nav-back'] }}
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
                  className="aspect-square w-full h-auto object-contain"
                />
                <div className="absolute right-2 top-2">
                  <button
                    type="button"
                    onClick={removeImage}
                    className="rounded-lg bg-stone-900/70 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-stone-900"
                  >
                    <PiXDuotone className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center border-2 border-dashed transition-all",
                  dragging
                    ? "border-indigo-400 bg-indigo-50/50 dark:border-indigo-600 dark:bg-indigo-900/10"
                    : "border-stone-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                )}
              >
                <PiUploadDuotone className="mb-3 h-8 w-8 text-stone-400 dark:text-zinc-500" />
                <p className="text-sm font-medium text-stone-900 dark:text-white">
                  Upload or take a photo
                </p>
                <p className="mt-1 text-xs text-stone-500 dark:text-zinc-500">
                  JPG, PNG, or WebP up to 10 MB
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={openFilePicker}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    <PiUploadDuotone className="h-3.5 w-3.5" />
                    Upload
                  </button>
                  <button
                    type="button"
                    onClick={openCamera}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
                  >
                    <PiCameraDuotone className="h-3.5 w-3.5" />
                    Take photo
                  </button>
                </div>
                <p className="mt-3 text-xs text-indigo-600 dark:text-indigo-400">
                  AI insights generated after upload
                </p>
              </div>
            )}
          </motion.div>

          {imagePreview && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={openFilePicker}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <PiUploadDuotone className="h-4 w-4" />
                Replace
              </button>
              <button
                type="button"
                onClick={openCamera}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
              >
                <PiCameraDuotone className="h-4 w-4" />
                Retake
              </button>
            </div>
          )}

          {/* AI analysis status */}
          {analyzing && (
            <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-800/40 dark:bg-indigo-950/30">
              <PiSpinnerDuotone className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />
              <span className="text-sm text-indigo-700 dark:text-indigo-300">Analyzing image…</span>
            </div>
          )}

          {insights && !analyzing && !!(insights.name || insights.description || (insights.price && insights.price > 0)) && (
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
                disabled={isBusy}
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
              disabled={isBusy}
              value={name}
              onChange={(e) => { setName(e.target.value); markDirty("name"); }}
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
              disabled={isBusy}
              value={description}
              onChange={(e) => { setDescription(e.target.value); markDirty("description"); }}
              placeholder="Brief description of the item..."
              className={inputClass}
            />
          </div>

          {/* Category + Condition */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-stone-900 dark:text-white">Category</label>
              <select id="category" name="category" disabled={isBusy} value={category} onChange={(e) => { setCategory(e.target.value); markDirty("category"); }} className={selectClass}>
                {INVENTORY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="condition" className="mb-1.5 block text-sm font-medium text-stone-900 dark:text-white">Condition</label>
              <select id="condition" name="condition" disabled={isBusy} value={condition} onChange={(e) => { setCondition(e.target.value); markDirty("condition"); }} className={selectClass}>
                {INVENTORY_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Price + Quantity */}
          <div className="grid gap-5 sm:grid-cols-2">
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
                disabled={isBusy}
                value={price}
                onChange={(e) => { setPrice(e.target.value); markDirty("price"); }}
                placeholder="0.00"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="quantity" className="mb-1.5 block text-sm font-medium text-stone-900 dark:text-white">
                Quantity
              </label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                min="1"
                step="1"
                disabled={isBusy}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
                className={inputClass}
              />
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
              disabled={isBusy}
              className="inline-flex items-center justify-center rounded-xl border border-transparent bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-lg transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitState === "submitting" ? (
                <><PiSpinnerDuotone className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
              ) : submitState === "success" ? (
                <><PiCheckDuotone className="mr-2 h-4 w-4" /> Added!</>
              ) : (
                "Add item"
              )}
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
