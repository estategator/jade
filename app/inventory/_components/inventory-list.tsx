"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  PiSpinnerDuotone,
  PiPlusDuotone,
  PiMagnifyingGlassDuotone,
  PiPackageDuotone,
  PiPencilDuotone,
  PiTrashDuotone,
  PiShoppingCartDuotone,
  PiSlidersDuotone,
  PiArrowUpDuotone,
  PiArrowDownDuotone,
  PiArrowsDownUpDuotone,
  PiXDuotone,
  PiImageBrokenDuotone,
  PiDotsThreeDuotone,
  PiQrCodeDuotone,
  PiImagesDuotone,
  PiCheckSquareDuotone,
  PiWarningDuotone,
} from "react-icons/pi";
import { PageHeader } from "@/app/components/page-header";
import {
  deleteInventoryItem,
  bulkDeleteInventoryItems,
  bulkUpdateInventoryStatus,
  type InventoryItem,
} from "@/app/inventory/actions";
import { QrCodeModal } from "@/app/inventory/_components/qr-code-modal";

type BulkAction =
  | { kind: "delete" }
  | { kind: "status"; status: "available" | "sold" | "reserved" };

const bulkActionLabels: Record<string, string> = {
  delete: "delete",
  available: "mark as available",
  sold: "mark as sold",
  reserved: "mark as reserved",
};

function BulkConfirmModal({
  action,
  count,
  busy,
  onConfirm,
  onCancel,
}: {
  action: BulkAction;
  count: number;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [busy, onCancel]);

  const label = action.kind === "delete"
    ? bulkActionLabels.delete
    : bulkActionLabels[action.status];
  const isDestructive = action.kind === "delete";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={() => { if (!busy) onCancel(); }}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            isDestructive
              ? "bg-red-100 dark:bg-red-900/30"
              : "bg-indigo-100 dark:bg-indigo-900/30"
          }`}>
            <PiWarningDuotone className={`h-5 w-5 ${
              isDestructive
                ? "text-red-600 dark:text-red-400"
                : "text-indigo-600 dark:text-indigo-400"
            }`} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-stone-900 dark:text-white">
              Confirm bulk action
            </h3>
            <p className="mt-1 text-sm text-stone-600 dark:text-zinc-400">
              Are you sure you want to {label}{" "}
              <span className="font-medium text-stone-900 dark:text-white">
                {count} {count === 1 ? "item" : "items"}
              </span>?
              {isDestructive && " This cannot be undone."}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
              isDestructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {busy && <PiSpinnerDuotone className="h-3.5 w-3.5 animate-spin" />}
            {isDestructive ? "Delete" : "Confirm"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

const statusColors: Record<string, string> = {
  available:
    "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
  sold: "bg-stone-100 text-stone-500 dark:bg-zinc-800 dark:text-zinc-400",
  reserved:
    "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
};

/**
 * Render a thumbnail for an inventory item with fallback logic:
 * 1. Show image if processing is complete/none AND image URL exists
 * 2. Show spinner if actively processing (queued/processing)
 * 3. Show error icon if processing failed or no image after complete
 */
function ItemThumbnail({ item }: { item: InventoryItem }) {
  const imageUrl = item.thumbnail_url || item.medium_image_url;
  const isProcessing = item.processing_status === "queued" || item.processing_status === "processing";
  const isFailed = item.processing_status === "failed";
  const isComplete = item.processing_status === "complete" || item.processing_status === "none";
  const shouldShowImage = isComplete && !!imageUrl && !isFailed;

  return (
    <div className="flex items-center justify-center h-10 w-10 rounded-lg border border-stone-200 bg-stone-50 dark:border-zinc-700 dark:bg-zinc-800 flex-shrink-0">
      {isProcessing ? (
        <PiSpinnerDuotone className="h-5 w-5 animate-spin text-stone-400 dark:text-zinc-600" />
      ) : shouldShowImage && imageUrl ? (
        <Image
          src={imageUrl}
          alt={item.name}
          width={40}
          height={40}
          className="h-10 w-10 rounded-md object-cover"
          unoptimized
        />
      ) : (
        <PiImageBrokenDuotone className="h-5 w-5 text-stone-400 dark:text-zinc-600" />
      )}
    </div>
  );
}

/**
 * Row-level action menu that shows icon-only buttons at md and
 * collapses into an overflow menu on mobile, keeping touch targets >= 44 px.
 */
function RowActions({
  item,
  buyingId,
  onBuy,
  onDelete,
  onQr,
}: {
  item: InventoryItem;
  buyingId: string | null;
  onBuy: (id: string) => void;
  onDelete: (id: string) => void;
  onQr: (item: InventoryItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
      <div className="flex items-center justify-end gap-1 relative" ref={menuRef}>
        {item.status === "available" && (
          <button
            type="button"
            onClick={() => onBuy(item.id)}
            disabled={buyingId === item.id}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 p-1.5 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 min-h-[32px] min-w-[32px]"
            title="Buy"
          >
            {buyingId === item.id ? (
              <PiSpinnerDuotone className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PiShoppingCartDuotone className="h-3.5 w-3.5" />
            )}
          </button>
        )}
        <Link
          href={`/inventory/${item.id}/edit`}
          className="inline-flex items-center justify-center rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white min-h-[32px] min-w-[32px]"
          title="Edit"
        >
          <PiPencilDuotone className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center justify-center rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white min-h-[32px] min-w-[32px]"
          title="More actions"
        >
          <PiDotsThreeDuotone className="h-3.5 w-3.5" />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full z-20 mt-1 min-w-[140px] overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
            >
              <button
                type="button"
                onClick={() => { onQr(item); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <PiQrCodeDuotone className="h-3.5 w-3.5" />
                QR Code
              </button>
              <button
                type="button"
                onClick={() => { onDelete(item.id); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                <PiTrashDuotone className="h-3.5 w-3.5" />
                Delete
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
  );
}

type InventoryListProps = Readonly<{
  initialItems: InventoryItem[];
  userId: string;
}>;

export function InventoryList({ initialItems, userId }: InventoryListProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [qrItem, setQrItem] = useState<InventoryItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [pendingBulkAction, setPendingBulkAction] = useState<BulkAction | null>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  // Clear selection when filter/search changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, projectFilter, statusFilter, categoryFilter, conditionFilter]);

  async function handleDelete(id: string) {
    const result = await deleteInventoryItem(id, userId);
    if (result.error) {
      setError(result.error);
    } else {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      router.refresh();
    }
  }

  async function handleBuy(itemId: string) {
    setBuyingId(itemId);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start checkout.");
        setBuyingId(null);
        return;
      }
      if (data.url) {
        window.location.assign(data.url);
      }
    } catch {
      setError("Failed to start checkout.");
      setBuyingId(null);
    }
  }

  const categories = Array.from(new Set(items.map((i) => i.category))).sort();
  const conditions = Array.from(new Set(items.map((i) => i.condition))).sort();
  
  const projectsMap = items.reduce((acc, item) => {
    if (item.project) {
      acc.set(item.project.id, { id: item.project.id, name: item.project.name, org_name: item.project.organizations?.name });
    }
    return acc;
  }, new Map<string, { id: string; name: string; org_name?: string }>());
  
  const projects = Array.from(projectsMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  const activeFilterCount = [projectFilter, statusFilter, categoryFilter, conditionFilter].filter((f) => f !== "all").length;

  function toggleSort(field: string) {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "price" ? "asc" : "asc");
    }
  }

  function clearFilters() {
    setProjectFilter("all");
    setStatusFilter("all");
    setCategoryFilter("all");
    setConditionFilter("all");
    setSearch("");
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(filteredIds: string[]) {
    setSelectedIds((prev) => {
      const allSelected = filteredIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(filteredIds);
    });
  }

  async function handleBulkDelete() {
    if (!selectedIds.size || bulkBusy) return;
    setBulkBusy(true);
    setError("");
    const ids = Array.from(selectedIds);
    const result = await bulkDeleteInventoryItems(ids, userId);
    if (result.error) {
      setError(result.error);
    } else {
      setItems((prev) => prev.filter((i) => !selectedIds.has(i.id)));
      setSelectedIds(new Set());
      router.refresh();
    }
    setBulkBusy(false);
    setPendingBulkAction(null);
  }

  async function handleBulkStatus(status: 'available' | 'sold' | 'reserved') {
    if (!selectedIds.size || bulkBusy) return;
    setBulkBusy(true);
    setError("");
    const ids = Array.from(selectedIds);
    const result = await bulkUpdateInventoryStatus(ids, userId, status);
    if (result.error) {
      setError(result.error);
    } else {
      setItems((prev) => prev.map((i) =>
        selectedIds.has(i.id) ? { ...i, status } : i
      ));
      setSelectedIds(new Set());
      router.refresh();
    }
    setBulkBusy(false);
    setPendingBulkAction(null);
  }

  const handleConfirmBulkAction = useCallback(() => {
    if (!pendingBulkAction) return;
    if (pendingBulkAction.kind === "delete") {
      handleBulkDelete();
    } else {
      handleBulkStatus(pendingBulkAction.status);
    }
  }, [pendingBulkAction, selectedIds, bulkBusy]);

  const filtered = items
    .filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.category.toLowerCase().includes(search.toLowerCase());
      const matchesProject = projectFilter === "all" || item.project?.id === projectFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      const matchesCondition = conditionFilter === "all" || item.condition === conditionFilter;
      return matchesSearch && matchesProject && matchesStatus && matchesCategory && matchesCondition;
    })
    .sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      switch (sortField) {
        case "name":
          return dir * a.name.localeCompare(b.name);
        case "price":
          return dir * (a.price - b.price);
        case "category":
          return dir * a.category.localeCompare(b.category);
        case "status":
          return dir * a.status.localeCompare(b.status);
        case "condition":
          return dir * a.condition.localeCompare(b.condition);
        case "created_at":
        default:
          return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
    });

  return (
    <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Inventory"
        description={`Manage and track all your estate sale items — ${items.length} ${items.length === 1 ? "item" : "items"} across all projects.`}
        actions={[
          { label: "Bulk add", href: "/inventory/bulk", icon: PiImagesDuotone, variant: "secondary" },
          { label: "Add item", href: "/inventory/add", icon: PiPlusDuotone, variant: "primary" },
        ]}
      />

      {/* Search & Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="mb-6 space-y-3"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1 min-w-[200px]">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <PiMagnifyingGlassDuotone className="h-4 w-4 text-stone-400 dark:text-zinc-500" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or category…"
              className="block w-full rounded-xl border border-stone-300 bg-white py-2.5 pl-10 pr-3 text-sm text-stone-900 placeholder-stone-400 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:placeholder-stone-500"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
              showFilters || activeFilterCount > 0
                ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400"
                : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            <PiSlidersDuotone className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900 dark:text-zinc-500 dark:hover:text-white"
            >
              <PiXDuotone className="h-3.5 w-3.5" />
              Clear all
            </button>
          )}
        </div>

        {/* Filter dropdowns */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-wrap gap-3 rounded-xl border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="min-w-[150px]">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-zinc-500">
                Project
              </label>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="all">All projects</option>
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name} {proj.org_name ? `(${proj.org_name})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[150px]">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-zinc-500">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="all">All statuses</option>
                <option value="available">Available</option>
                <option value="sold">Sold</option>
                <option value="reserved">Reserved</option>
              </select>
            </div>
            <div className="min-w-[150px]">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-zinc-500">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="all">All categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[150px]">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-zinc-500">
                Condition
              </label>
              <select
                value={conditionFilter}
                onChange={(e) => setConditionFilter(e.target.value)}
                className="block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="all">All conditions</option>
                {conditions.map((cond) => (
                  <option key={cond} value={cond}>
                    {cond}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[180px]">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-zinc-500">
                Sort by
              </label>
              <div className="flex gap-2">
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value)}
                  className="block flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="created_at">Date added</option>
                  <option value="name">Name</option>
                  <option value="price">Price</option>
                  <option value="category">Category</option>
                  <option value="status">Status</option>
                  <option value="condition">Condition</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
                  className="inline-flex items-center justify-center rounded-lg border border-stone-300 bg-white px-2.5 text-stone-600 transition-colors hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  title={sortDirection === "asc" ? "Ascending" : "Descending"}
                >
                  {sortDirection === "asc" ? (
                    <PiArrowUpDuotone className="h-4 w-4" />
                  ) : (
                    <PiArrowDownDuotone className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400"
        >
          {error}
        </motion.p>
      )}

      {/* Bulk actions bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-800/40 dark:bg-indigo-950/30"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-indigo-700 dark:text-indigo-300">
              <PiCheckSquareDuotone className="h-4 w-4" />
              {selectedIds.size} selected
            </div>
            <div className="h-4 w-px bg-indigo-200 dark:bg-indigo-800" />
            <button
              type="button"
              onClick={() => setPendingBulkAction({ kind: 'status', status: 'available' })}
              disabled={bulkBusy}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
            >
              Mark Available
            </button>
            <button
              type="button"
              onClick={() => setPendingBulkAction({ kind: 'status', status: 'reserved' })}
              disabled={bulkBusy}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
            >
              Mark Reserved
            </button>
            <button
              type="button"
              onClick={() => setPendingBulkAction({ kind: 'status', status: 'sold' })}
              disabled={bulkBusy}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-200 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-700"
            >
              Mark Sold
            </button>
            <div className="h-4 w-px bg-indigo-200 dark:bg-indigo-800" />
            <button
              type="button"
              onClick={() => setPendingBulkAction({ kind: 'delete' })}
              disabled={bulkBusy}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/30"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto rounded-lg px-3 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
            >
              Clear selection
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Items */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900"
        >
          <PiPackageDuotone className="mx-auto mb-4 h-10 w-10 text-stone-400 dark:text-zinc-600" />
          <h3 className="text-lg font-bold text-stone-900 dark:text-white">
            {search ? "No matching items" : "No items yet"}
          </h3>
          <p className="mt-2 text-sm text-stone-600 dark:text-zinc-400">
            {search
              ? "Try a different search term."
              : "Add your first item to start building your catalogue."}
          </p>
          {!search && (
            <Link
              href="/inventory/add"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-indigo-700"
            >
              <PiPlusDuotone className="h-4 w-4" />
              Add item
            </Link>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
        >
          {/* Table header */}
          <div className="hidden border-b border-stone-200 px-4 py-3 lg:grid lg:grid-cols-[32px_1fr] lg:gap-4 lg:px-5 dark:border-zinc-800">
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={filtered.length > 0 && filtered.every((i) => selectedIds.has(i.id))}
                onChange={() => toggleSelectAll(filtered.map((i) => i.id))}
                className="h-4 w-4 rounded border-stone-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
              />
            </div>
            <div className="grid grid-cols-12 gap-3 lg:gap-4">
            <span className="col-span-1 text-xs font-medium uppercase tracking-wider text-stone-500">
              Image
            </span>
            <button type="button" onClick={() => toggleSort("name")} className="col-span-2 lg:col-span-3 flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-stone-500 hover:text-stone-900 dark:hover:text-white transition-colors">
              Name
              {sortField === "name" ? (sortDirection === "asc" ? <PiArrowUpDuotone className="h-3 w-3" /> : <PiArrowDownDuotone className="h-3 w-3" />) : <PiArrowsDownUpDuotone className="h-3 w-3 opacity-0 group-hover:opacity-100" />}
            </button>
            <span className="col-span-2 text-xs font-medium uppercase tracking-wider text-stone-500">
              Project
            </span>
            <button type="button" onClick={() => toggleSort("category")} className="col-span-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-stone-500 hover:text-stone-900 dark:hover:text-white transition-colors">
              Category
              {sortField === "category" ? (sortDirection === "asc" ? <PiArrowUpDuotone className="h-3 w-3" /> : <PiArrowDownDuotone className="h-3 w-3" />) : null}
            </button>
            <button type="button" onClick={() => toggleSort("condition")} className="col-span-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-stone-500 hover:text-stone-900 dark:hover:text-white transition-colors">
              Condition
              {sortField === "condition" ? (sortDirection === "asc" ? <PiArrowUpDuotone className="h-3 w-3" /> : <PiArrowDownDuotone className="h-3 w-3" />) : null}
            </button>
            <span className="col-span-1 text-xs font-medium uppercase tracking-wider text-stone-500">
              Qty
            </span>
            <button type="button" onClick={() => toggleSort("price")} className="col-span-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-stone-500 hover:text-stone-900 dark:hover:text-white transition-colors">
              Price
              {sortField === "price" ? (sortDirection === "asc" ? <PiArrowUpDuotone className="h-3 w-3" /> : <PiArrowDownDuotone className="h-3 w-3" />) : null}
            </button>
            <button type="button" onClick={() => toggleSort("status")} className="col-span-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-stone-500 hover:text-stone-900 dark:hover:text-white transition-colors">
              Status
              {sortField === "status" ? (sortDirection === "asc" ? <PiArrowUpDuotone className="h-3 w-3" /> : <PiArrowDownDuotone className="h-3 w-3" />) : null}
            </button>
            <span className="col-span-1 text-xs font-medium uppercase tracking-wider text-stone-500 text-right">
              Actions
            </span>
            </div>
          </div>

          {/* Rows */}
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`grid grid-cols-1 gap-2 border-b border-stone-100 px-4 py-3 last:border-b-0 lg:grid-cols-[32px_1fr] lg:items-center lg:gap-4 lg:px-5 lg:py-4 dark:border-zinc-800/50 transition-colors ${selectedIds.has(item.id) ? "bg-indigo-50/50 dark:bg-indigo-950/20" : ""}`}
            >
              <div className="hidden lg:flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  className="h-4 w-4 rounded border-stone-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
                />
              </div>
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-12 lg:items-center lg:gap-4">
              <div className="col-span-1 flex justify-center sm:justify-start">
                <ItemThumbnail item={item} />
              </div>
              <div className="col-span-2 lg:col-span-3 min-w-0">
                <p className="truncate text-sm font-semibold text-stone-900 dark:text-white">
                  {item.name}
                </p>
                {item.description && (
                  <p className="mt-0.5 truncate text-xs text-stone-500 dark:text-zinc-500">
                    {item.description}
                  </p>
                )}
              </div>
              <div className="col-span-2 min-w-0">
                {item.project ? (
                  <>
                    <p className="truncate text-sm text-stone-600 dark:text-zinc-400">
                      {item.project.name}
                    </p>
                    {item.project.organizations?.name && (
                      <p className="truncate text-xs text-stone-400 dark:text-zinc-600">
                        {item.project.organizations.name}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-stone-400 italic dark:text-zinc-600">
                    No project
                  </p>
                )}
              </div>
              <p className="col-span-1 truncate text-sm text-stone-600 dark:text-zinc-400">
                {item.category}
              </p>
              <p className="col-span-1 truncate text-sm text-stone-600 dark:text-zinc-400">
                {item.condition}
              </p>
              <p className="col-span-1 text-sm tabular-nums text-stone-600 dark:text-zinc-400">
                {item.quantity ?? 1}
              </p>
              <p className="col-span-1 text-sm font-medium text-stone-900 dark:text-white">
                ${item.price.toFixed(2)}
              </p>
              <div className="col-span-1">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[item.status] || ""}`}
                >
                  {item.status}
                </span>
              </div>
              <div className="col-span-1 flex justify-end">
                <RowActions
                  item={item}
                  buyingId={buyingId}
                  onBuy={handleBuy}
                  onDelete={handleDelete}
                  onQr={setQrItem}
                />
              </div>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* QR Code Modal */}
      {qrItem && (
        <QrCodeModal
          itemId={qrItem.id}
          itemName={qrItem.name}
          onClose={() => setQrItem(null)}
        />
      )}

      {/* Bulk action confirmation modal */}
      <AnimatePresence>
        {pendingBulkAction && (
          <BulkConfirmModal
            action={pendingBulkAction}
            count={selectedIds.size}
            busy={bulkBusy}
            onConfirm={handleConfirmBulkAction}
            onCancel={() => setPendingBulkAction(null)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
