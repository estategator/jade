"use client";

import { useState } from "react";
import { FileSignature, X } from "lucide-react";
import { createPortal } from "react-dom";

import type { AgreementType } from "@/lib/agreement-types";
import { AGREEMENT_TYPE_OPTIONS } from "@/lib/agreement-types";

const radioClass =
  "cursor-pointer rounded-xl border-2 px-4 py-3 text-left transition";

const activeClass =
  "border-[var(--color-brand-primary)] bg-indigo-50/60 dark:bg-indigo-950/20";

const inactiveClass =
  "border-stone-200 bg-white hover:border-stone-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600";

type AgreementTypeSelectorProps = Readonly<{
  onSelect: (type: AgreementType) => void;
  onCancel: () => void;
}>;

export function AgreementTypeSelector({
  onSelect,
  onCancel,
}: AgreementTypeSelectorProps) {
  const [selected, setSelected] = useState<AgreementType>("estate_sale");

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 dark:border-zinc-700/70">
          <div className="flex items-center gap-2">
            <FileSignature className="h-4 w-4 text-[var(--color-brand-primary)]" />
            <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
              Choose contract type
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-2 px-5 py-4">
          {AGREEMENT_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelected(opt.value)}
              className={`${radioClass} w-full ${selected === opt.value ? activeClass : inactiveClass}`}
            >
              <p className="text-sm font-medium text-stone-900 dark:text-white">
                {opt.label}
              </p>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-stone-200 px-5 py-3 dark:border-zinc-700/70">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSelect(selected)}
            className="rounded-xl bg-[var(--color-brand-primary)] px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--color-brand-primary-hover)]"
          >
            Continue
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
