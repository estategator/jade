"use client";

import { useState, useEffect, useRef } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { Modal } from "@/app/components/ui/modal";

type ConfirmDeleteModalProps = Readonly<{
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  entityName: string;
  entityType: string;
  description?: string;
  actionLabel?: string;
}>;

export default function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  entityName,
  entityType,
  description,
  actionLabel = "Delete",
}: ConfirmDeleteModalProps) {
  const [inputValue, setInputValue] = useState("");
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = inputValue === entityName;

  useEffect(() => {
    if (open) {
      setInputValue("");
      setDeleting(false);
      // Focus input after animation settles
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [open]);

  async function handleConfirm() {
    if (!matches || deleting) return;
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal open={open} size="md" ariaLabel={`${actionLabel} ${entityType}`}>
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                  {actionLabel} {entityType}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={deleting}
                className="rounded-lg p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Warning */}
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/30">
              <p className="text-sm text-red-700 dark:text-red-300">
                This action <strong>cannot be undone</strong>.
                {description ? ` ${description}` : ` This will permanently ${actionLabel.toLowerCase()} the ${entityType} and all associated data.`}
              </p>
            </div>

            {/* Confirmation input */}
            <label className="block mb-4">
              <span className="text-sm text-stone-700 dark:text-zinc-300">
                Type <strong className="text-stone-900 dark:text-white">{entityName}</strong> to confirm
              </span>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
                disabled={deleting}
                className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 transition-colors focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-red-500 dark:focus:ring-red-500/20"
                placeholder={entityName}
                autoComplete="off"
              />
            </label>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={deleting}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-all hover:bg-stone-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!matches || deleting}
                className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-zinc-900"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {actionLabel} {entityType}
              </button>
            </div>
    </Modal>
  );
}