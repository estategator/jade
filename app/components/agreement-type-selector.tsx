"use client";

import { useState } from "react";
import { FileSignature, LayoutTemplate, X } from "lucide-react";
import { createPortal } from "react-dom";

import type { AgreementType } from "@/lib/agreement-types";
import { AGREEMENT_TYPE_OPTIONS } from "@/lib/agreement-types";

const radioClass =
  "cursor-pointer rounded-xl border-2 px-4 py-3 text-left transition";

const activeClass =
  "border-[var(--color-brand-primary)] bg-indigo-50/60 dark:bg-indigo-950/20";

const inactiveClass =
  "border-stone-200 bg-white hover:border-stone-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600";

/** Minimal template shape the picker needs */
export type PickerTemplate = {
  id: string;
  name: string;
  agreement_type: string;
};

export type ContractSelection =
  | { kind: "builtin"; agreementType: AgreementType }
  | {
      kind: "template";
      agreementType: AgreementType;
      templateId: string;
      templateName: string;
    };

type AgreementTypeSelectorProps = Readonly<{
  /** Called when "Continue" is pressed. */
  onSelect: (type: AgreementType, selection?: ContractSelection) => void;
  onCancel: () => void;
  /** Org contract templates to display alongside built-in types. */
  templates?: PickerTemplate[];
}>;

export function AgreementTypeSelector({
  onSelect,
  onCancel,
  templates,
}: AgreementTypeSelectorProps) {
  const [selected, setSelected] = useState<AgreementType>("estate_sale");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );

  const hasTemplates = templates && templates.length > 0;

  const handleContinue = () => {
    if (selectedTemplateId && templates) {
      const tpl = templates.find((t) => t.id === selectedTemplateId);
      if (tpl) {
        const agreementType = AGREEMENT_TYPE_OPTIONS.some(
          (o) => o.value === tpl.agreement_type,
        )
          ? (tpl.agreement_type as AgreementType)
          : "estate_sale";

        onSelect(agreementType, {
          kind: "template",
          agreementType,
          templateId: tpl.id,
          templateName: tpl.name,
        });
        return;
      }
    }

    onSelect(selected, { kind: "builtin", agreementType: selected });
  };

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

        {/* Built-in types */}
        <div className="space-y-2 px-5 py-4">
          {AGREEMENT_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setSelected(opt.value);
                setSelectedTemplateId(null);
              }}
              className={`${radioClass} w-full ${
                selected === opt.value && !selectedTemplateId
                  ? activeClass
                  : inactiveClass
              }`}
            >
              <p className="text-sm font-medium text-stone-900 dark:text-white">
                {opt.label}
              </p>
            </button>
          ))}

          {/* Org templates */}
          {hasTemplates && (
            <>
              <div className="flex items-center gap-2 pt-2">
                <LayoutTemplate className="h-3.5 w-3.5 text-stone-400 dark:text-zinc-500" />
                <span className="text-xs font-medium text-stone-500 dark:text-zinc-400">
                  Your templates
                </span>
              </div>
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    setSelectedTemplateId(tpl.id);
                  }}
                  className={`${radioClass} w-full ${
                    selectedTemplateId === tpl.id ? activeClass : inactiveClass
                  }`}
                >
                  <p className="text-sm font-medium text-stone-900 dark:text-white">
                    {tpl.name}
                  </p>
                </button>
              ))}
            </>
          )}
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
            onClick={handleContinue}
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
