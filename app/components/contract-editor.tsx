"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  FileSignature,
  Loader2,
  Percent,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";

import type {
  ContractAdditionalCharge,
  ContractDetail,
  ContractDiscountDay,
  UnsoldItemsHandling,
} from "@/app/onboarding/actions";
import {
  createContractDraft,
  deleteContractDraft,
  updateContractDraft,
  sendContract,
} from "@/app/onboarding/actions";
import type { AgreementType } from "@/lib/agreement-types";
import { AGREEMENT_TYPE_DEFAULTS } from "@/lib/agreement-types";
import { Modal } from "@/app/components/ui/modal";

// ── Helpers ──────────────────────────────────────────────────

const UNSOLD_OPTIONS: { value: UnsoldItemsHandling; label: string }[] = [
  { value: "client_keeps", label: "Client keeps" },
  { value: "donate", label: "Donate to charity" },
  { value: "haul_away", label: "Haul away / dispose" },
  { value: "negotiate", label: "Negotiate after sale" },
];

const PROVIDER_OPTIONS = [
  { value: "manual", label: "Manual / in-person" },
  { value: "docusign", label: "DocuSign" },
  { value: "dropbox_sign", label: "Dropbox Sign" },
  { value: "docuseal", label: "Docuseal" },
] as const;

const inputClass =
  "w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-brand-primary)]/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-600 dark:focus:ring-[var(--color-brand-primary)]/25";

const labelClass =
  "block text-xs font-semibold text-stone-700 dark:text-zinc-300 mb-1.5";

// ── Props ────────────────────────────────────────────────────

type ContractEditorProps = Readonly<{
  /** Assignment ID — required when creating a new contract */
  assignmentId: string;
  /** Agreement type — required for new contracts */
  agreementType: AgreementType;
  /** Existing contract to edit (null = new draft) */
  contract: ContractDetail | null;
  /** Client display name (for header) */
  clientName: string;
  /** Project display name (for header) */
  projectName: string;
  /** Called when the editor should close */
  onClose: () => void;
}>;

export function ContractEditor({
  assignmentId,
  agreementType,
  contract,
  clientName,
  projectName,
  onClose,
}: ContractEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Form state ─────────────────────────────────────────────
  const [provider, setProvider] = useState(contract?.provider ?? "manual");
  const [templateName, setTemplateName] = useState(
    contract?.template_name ?? AGREEMENT_TYPE_DEFAULTS[contract?.agreement_type ?? agreementType],
  );

  // Commission
  const [commissionRate, setCommissionRate] = useState(
    contract?.commission_rate?.toString() ?? "",
  );
  const [minimumCommission, setMinimumCommission] = useState(
    contract?.minimum_commission?.toString() ?? "",
  );

  // Fees
  const [flatFee, setFlatFee] = useState(
    contract?.flat_fee?.toString() ?? "",
  );
  const [additionalCharges, setAdditionalCharges] = useState<
    ContractAdditionalCharge[]
  >(contract?.additional_charges ?? []);
  const [newChargeLabel, setNewChargeLabel] = useState("");
  const [newChargeAmount, setNewChargeAmount] = useState("");

  // Sale terms
  const [saleDurationDays, setSaleDurationDays] = useState(
    contract?.sale_duration_days?.toString() ?? "",
  );
  const [discountSchedule, setDiscountSchedule] = useState<
    ContractDiscountDay[]
  >(contract?.discount_schedule ?? []);
  const [newDiscountDay, setNewDiscountDay] = useState("");
  const [newDiscountPercent, setNewDiscountPercent] = useState("");
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [unsoldHandling, setUnsoldHandling] = useState<UnsoldItemsHandling>(
    contract?.unsold_items_handling ?? "client_keeps",
  );

  // Payment & cancellation
  const [paymentTermsDays, setPaymentTermsDays] = useState(
    contract?.payment_terms_days?.toString() ?? "14",
  );
  const [cancellationFee, setCancellationFee] = useState(
    contract?.cancellation_fee?.toString() ?? "",
  );

  // Special terms
  const [specialTerms, setSpecialTerms] = useState(
    contract?.special_terms ?? "",
  );

  const isDraft = !contract || contract.status === "draft";
  const isExisting = !!contract;

  // ── Charge management ──────────────────────────────────────

  const addCharge = useCallback(() => {
    const label = newChargeLabel.trim();
    const amount = parseFloat(newChargeAmount);
    if (!label || isNaN(amount) || amount <= 0) return;
    setAdditionalCharges((prev) => [...prev, { label, amount }]);
    setNewChargeLabel("");
    setNewChargeAmount("");
  }, [newChargeLabel, newChargeAmount]);

  const removeCharge = useCallback((index: number) => {
    setAdditionalCharges((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Discount schedule management ───────────────────────────

  const addDiscount = useCallback(() => {
    setDiscountError(null);
    const day = parseInt(newDiscountDay, 10);
    const percent = parseFloat(newDiscountPercent);
    if (isNaN(day) || day < 1) {
      setDiscountError("Enter a valid day (1 or higher).");
      return;
    }
    if (isNaN(percent) || percent <= 0 || percent > 100) {
      setDiscountError("Enter a valid discount percent (1–100).");
      return;
    }
    const maxDay = saleDurationDays ? parseInt(saleDurationDays, 10) : null;
    if (maxDay && !isNaN(maxDay) && day > maxDay) {
      setDiscountError(`Day cannot exceed sale duration (${maxDay} days).`);
      return;
    }
    setDiscountSchedule((prev) => {
      if (prev.some((d) => d.day === day)) {
        setDiscountError(`Day ${day} already has a discount. Remove it first.`);
        return prev;
      }
      return [...prev, { day, percent }].sort((a, b) => a.day - b.day);
    });
    setNewDiscountDay("");
    setNewDiscountPercent("");
  }, [newDiscountDay, newDiscountPercent, saleDurationDays]);

  const removeDiscount = useCallback((index: number) => {
    setDiscountSchedule((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Build FormData ─────────────────────────────────────────

  const buildFormData = useCallback((): FormData => {
    const fd = new FormData();
    if (contract) {
      fd.set("contract_id", contract.id);
    } else {
      fd.set("assignment_id", assignmentId);
    }
    fd.set("agreement_type", contract?.agreement_type ?? agreementType);
    fd.set("provider", provider);
    fd.set("template_name", templateName);
    if (commissionRate) fd.set("commission_rate", commissionRate);
    if (minimumCommission) fd.set("minimum_commission", minimumCommission);
    if (flatFee) fd.set("flat_fee", flatFee);
    fd.set("additional_charges", JSON.stringify(additionalCharges));
    if (saleDurationDays) fd.set("sale_duration_days", saleDurationDays);
    fd.set("discount_schedule", JSON.stringify(discountSchedule));
    fd.set("unsold_items_handling", unsoldHandling);
    if (paymentTermsDays) fd.set("payment_terms_days", paymentTermsDays);
    if (cancellationFee) fd.set("cancellation_fee", cancellationFee);
    fd.set("special_terms", specialTerms);
    return fd;
  }, [
    contract,
    assignmentId,
    provider,
    templateName,
    commissionRate,
    minimumCommission,
    flatFee,
    additionalCharges,
    saleDurationDays,
    discountSchedule,
    unsoldHandling,
    paymentTermsDays,
    cancellationFee,
    specialTerms,
  ]);

  // ── Actions ────────────────────────────────────────────────

  const handleSave = () => {
    setError(null);
    setSuccess(null);
    const fd = buildFormData();

    startTransition(async () => {
      const res = isExisting
        ? await updateContractDraft(fd)
        : await createContractDraft(fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess(isExisting ? "Contract updated." : "Draft created.");
      router.refresh();
    });
  };

  const handleSend = () => {
    if (!contract) return;
    setError(null);
    setSuccess(null);

    const fd = new FormData();
    fd.set("contract_id", contract.id);

    startTransition(async () => {
      const res = await sendContract(fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess("Contract sent to client!");
      router.refresh();
      // Close editor after a short delay so user sees the success message
      setTimeout(onClose, 1200);
    });
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <Modal open scrollable size="2xl" panelClassName="p-0">
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4 dark:border-zinc-700/70">
        <div>
          <h3 className="text-base font-semibold text-stone-900 dark:text-white">
            {isExisting ? "Edit Contract" : "New Contract"}
          </h3>
          <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
            {clientName} &middot; {projectName}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="divide-y divide-stone-100 dark:divide-zinc-800">
        {/* Alerts */}
        {(error || success) && (
          <div className="px-6 pt-5">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                {success}
              </div>
            )}
          </div>
        )}

        {/* ── Contract basics ─────────────────────────────── */}
        <fieldset disabled={!isDraft || isPending} className="px-6 pt-6 pb-5">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
            Contract Details
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ce-title" className={labelClass}>
                Contract title
              </label>
              <input
                id="ce-title"
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="ce-provider" className={labelClass}>
                Signing method
              </label>
              <select
                id="ce-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className={inputClass}
              >
                {PROVIDER_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        {/* ── Commission ──────────────────────────────────── */}
        <fieldset disabled={!isDraft || isPending} className="px-6 pt-6 pb-5">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
            Commission
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ce-comm-rate" className={labelClass}>
                Commission rate
              </label>
              <div className="relative">
                <input
                  id="ce-comm-rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                  placeholder="e.g. 35"
                  className={`${inputClass} pr-8`}
                />
                <Percent className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400 dark:text-zinc-500" />
              </div>
            </div>
            <div>
              <label htmlFor="ce-min-comm" className={labelClass}>
                Minimum commission
              </label>
              <div className="relative">
                <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400 dark:text-zinc-500" />
                <input
                  id="ce-min-comm"
                  type="number"
                  min="0"
                  step="50"
                  value={minimumCommission}
                  onChange={(e) => setMinimumCommission(e.target.value)}
                  placeholder="e.g. 500"
                  className={`${inputClass} pl-8`}
                />
              </div>
            </div>
          </div>
        </fieldset>

        {/* ── Fees ────────────────────────────────────────── */}
        <fieldset disabled={!isDraft || isPending} className="px-6 pt-6 pb-5">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
            Fees &amp; Charges
          </legend>

          {/* Flat fee */}
          <div className="mb-4">
            <label htmlFor="ce-flat-fee" className={labelClass}>
              Flat service fee
            </label>
            <div className="relative max-w-xs">
              <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400 dark:text-zinc-500" />
              <input
                id="ce-flat-fee"
                type="number"
                min="0"
                step="25"
                value={flatFee}
                onChange={(e) => setFlatFee(e.target.value)}
                placeholder="0"
                className={`${inputClass} pl-8`}
              />
            </div>
          </div>

          {/* Additional charges list */}
          <div>
            <p className={labelClass}>Additional charges</p>
            {additionalCharges.length > 0 && (
              <div className="mb-2 space-y-1.5">
                {additionalCharges.map((charge, i) => (
                  <div
                    key={`${charge.label}-${i}`}
                    className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2.5 dark:border-zinc-700 dark:bg-zinc-950/40"
                  >
                    <span className="flex-1 text-sm text-stone-800 dark:text-zinc-200">
                      {charge.label}
                    </span>
                    <span className="text-sm font-medium text-stone-900 dark:text-white">
                      ${charge.amount.toFixed(2)}
                    </span>
                    {isDraft && (
                      <button
                        type="button"
                        onClick={() => removeCharge(i)}
                        className="text-stone-400 transition hover:text-red-500 dark:text-zinc-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add charge inline */}
            {isDraft && (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={newChargeLabel}
                    onChange={(e) => setNewChargeLabel(e.target.value)}
                    placeholder="Charge name"
                    className={inputClass}
                  />
                </div>
                <div className="relative w-32">
                  <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400 dark:text-zinc-500" />
                  <input
                    type="number"
                    min="0"
                    step="25"
                    value={newChargeAmount}
                    onChange={(e) => setNewChargeAmount(e.target.value)}
                    placeholder="0"
                    className={`${inputClass} pl-8`}
                  />
                </div>
                <button
                  type="button"
                  onClick={addCharge}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-xs font-medium text-stone-700 transition hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>
            )}
          </div>
        </fieldset>

        {/* ── Sale Terms ──────────────────────────────────── */}
        <fieldset disabled={!isDraft || isPending} className="px-6 pt-6 pb-5">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
            Sale Terms
          </legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ce-duration" className={labelClass}>
                Sale duration (days)
              </label>
              <input
                id="ce-duration"
                type="number"
                min="1"
                max="90"
                value={saleDurationDays}
                onChange={(e) => setSaleDurationDays(e.target.value)}
                placeholder="e.g. 3"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="ce-unsold" className={labelClass}>
                Unsold items handling
              </label>
              <select
                id="ce-unsold"
                value={unsoldHandling}
                onChange={(e) =>
                  setUnsoldHandling(e.target.value as UnsoldItemsHandling)
                }
                className={inputClass}
              >
                {UNSOLD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Discount schedule */}
          <div className="mt-4">
            <p className={labelClass}>Discount schedule</p>
            {discountSchedule.length > 0 && (
              <div className="mb-2 space-y-1.5">
                {discountSchedule.map((d, i) => (
                  <div
                    key={`day-${d.day}-${i}`}
                    className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2.5 dark:border-zinc-700 dark:bg-zinc-950/40"
                  >
                    <span className="flex-1 text-sm text-stone-800 dark:text-zinc-200">
                      Day {d.day}
                    </span>
                    <span className="text-sm font-medium text-stone-900 dark:text-white">
                      {d.percent}% off
                    </span>
                    {isDraft && (
                      <button
                        type="button"
                        onClick={() => removeDiscount(i)}
                        className="text-stone-400 transition hover:text-red-500 dark:text-zinc-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {isDraft && (
              <div className="flex flex-col gap-2">
                {discountError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{discountError}</p>
                )}
                <div className="flex items-end gap-2">
                <div className="w-24">
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={newDiscountDay}
                    onChange={(e) => { setNewDiscountDay(e.target.value); setDiscountError(null); }}
                    placeholder="Day"
                    className={inputClass}
                  />
                </div>
                <div className="relative w-28">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newDiscountPercent}
                    onChange={(e) => { setNewDiscountPercent(e.target.value); setDiscountError(null); }}
                    placeholder="% off"
                    className={inputClass}
                  />
                  <Percent className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400 dark:text-zinc-500" />
                </div>
                <button
                  type="button"
                  onClick={addDiscount}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-xs font-medium text-stone-700 transition hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
                </div>
              </div>
            )}
          </div>
        </fieldset>

        {/* ── Payment & Cancellation ──────────────────────── */}
        <fieldset disabled={!isDraft || isPending} className="px-6 pt-6 pb-5">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
            Payment &amp; Cancellation
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ce-payment-days" className={labelClass}>
                Payment terms (days after sale)
              </label>
              <input
                id="ce-payment-days"
                type="number"
                min="0"
                max="90"
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="ce-cancel-fee" className={labelClass}>
                Cancellation fee
              </label>
              <div className="relative">
                <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400 dark:text-zinc-500" />
                <input
                  id="ce-cancel-fee"
                  type="number"
                  min="0"
                  step="25"
                  value={cancellationFee}
                  onChange={(e) => setCancellationFee(e.target.value)}
                  placeholder="0"
                  className={`${inputClass} pl-8`}
                />
              </div>
            </div>
          </div>
        </fieldset>

        {/* ── Special Terms ───────────────────────────────── */}
        <fieldset disabled={!isDraft || isPending} className="px-6 pt-6 pb-5">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
            Special Terms &amp; Notes
          </legend>
          <textarea
            value={specialTerms}
            onChange={(e) => setSpecialTerms(e.target.value)}
            rows={4}
            placeholder="Any additional terms, conditions, or notes for this contract…"
            className={`${inputClass} resize-y`}
          />
        </fieldset>
      </div>

      {/* ── Footer actions ────────────────────────────────── */}
      {isDraft && (
        <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4 dark:border-zinc-700/70">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-xl px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            {isExisting && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  if (!confirm("Delete this draft contract? This cannot be undone.")) return;
                  startTransition(async () => {
                    const res = await deleteContractDraft(contract!.id);
                    if (res.error) {
                      setError(res.error);
                      return;
                    }
                    router.refresh();
                    onClose();
                  });
                }}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:text-zinc-300"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isExisting ? "Save changes" : "Save draft"}
            </button>
            {isExisting && (
              <button
                type="button"
                onClick={handleSend}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-primary)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--color-brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send to client
              </button>
            )}
          </div>
        </div>
      )}

      {/* Read-only footer for sent/signed contracts */}
      {!isDraft && (
        <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4 dark:border-zinc-700/70">
          <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-zinc-500">
            <FileSignature className="h-3.5 w-3.5" />
            Contract is {contract?.status} — editing is locked.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </div>
      )}
    </div>
    </Modal>
  );
}
