"use client";

import { useState } from "react";
import { FileSignature, LayoutTemplate, Plus, X } from "lucide-react";
import { Modal } from "@/app/components/ui/modal";

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
  | { kind: "create" }
  | {
      kind: "template";
      agreementType: AgreementType;
      templateId: string;
      templateName: string;
    };

type SelectionState =
  | { kind: "template"; id: string }
  | { kind: "curator"; value: AgreementType }
  | { kind: "create" }
  | null;

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
  const [selection, setSelection] = useState<SelectionState>(null);

  const hasTemplates = templates && templates.length > 0;

  const handleContinue = () => {
    if (!selection) return;

    if (selection.kind === "template" && templates) {
      const tpl = templates.find((t) => t.id === selection.id);
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

    if (selection.kind === "curator") {
      onSelect(selection.value, { kind: "builtin", agreementType: selection.value });
      return;
    }

    if (selection.kind === "create") {
      onSelect("estate_sale", { kind: "create" });
    }
  };

  return (
    <Modal open size="sm" panelClassName="p-0">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 dark:border-zinc-700/70">
          <div className="flex items-center gap-2">
            <FileSignature className="h-4 w-4 text-[var(--color-brand-primary)]" />
            <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
              Select contract
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

        <div className="space-y-5 px-5 py-4">
          {/* Org templates — shown first */}
          {hasTemplates && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 pb-0.5">
                <LayoutTemplate className="h-3.5 w-3.5 text-stone-400 dark:text-zinc-500" />
                <span className="text-xs font-medium text-stone-500 dark:text-zinc-400">
                  Your templates
                </span>
              </div>
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setSelection({ kind: "template", id: tpl.id })}
                  className={`${radioClass} w-full ${
                    selection?.kind === "template" && selection.id === tpl.id
                      ? activeClass
                      : inactiveClass
                  }`}
                >
                  <p className="text-sm font-medium text-stone-900 dark:text-white">
                    {tpl.name}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Curator built-in templates */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 pb-0.5">
              <FileSignature className="h-3.5 w-3.5 text-stone-400 dark:text-zinc-500" />
              <span className="text-xs font-medium text-stone-500 dark:text-zinc-400">
                Curator templates
              </span>
            </div>
            {AGREEMENT_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelection({ kind: "curator", value: opt.value })}
                className={`${radioClass} w-full ${
                  selection?.kind === "curator" && selection.value === opt.value
                    ? activeClass
                    : inactiveClass
                }`}
              >
                <p className="text-sm font-medium text-stone-900 dark:text-white">
                  {opt.label}
                </p>
              </button>
            ))}
          </div>

          {/* Create from scratch */}
          <div>
            <button
              type="button"
              onClick={() => setSelection({ kind: "create" })}
              className={`${radioClass} flex w-full items-center gap-3 ${
                selection?.kind === "create" ? activeClass : inactiveClass
              }`}
            >
              <Plus className="h-4 w-4 text-stone-500 dark:text-zinc-400" />
              <div>
                <p className="text-sm font-medium text-stone-900 dark:text-white">
                  Create contract
                </p>
                <p className="text-xs text-stone-500 dark:text-zinc-500">
                  Start from scratch
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-stone-200 px-5 py-4 dark:border-zinc-700/70">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selection}
            onClick={handleContinue}
            className="rounded-xl bg-[var(--color-brand-primary)] px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--color-brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continue
          </button>
        </div>
      </div>
    </Modal>
  );
}
