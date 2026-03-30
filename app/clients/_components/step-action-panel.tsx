"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  ExternalLink,
  FileSignature,
  Link2,
  Mail,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";

import type { OnboardingStepSummary } from "@/app/onboarding/actions";
import type {
  ClientContractSummary,
  ClientWalkthroughSummary,
  ClientWelcomeMessageSummary,
  ContractDetail,
} from "@/app/onboarding/actions";
import type { AgreementType } from "@/lib/agreement-types";
import {
  createProjectShareLink,
  deleteContractDraft,
  getContractDetail,
  recordClientProvidedContract,
  scheduleWalkthrough,
  sendClientPortalEmail,
  sendWelcomeEmail,
  updateOnboardingStepStatus,
} from "@/app/onboarding/actions";
import { ContractEditor } from "@/app/components/contract-editor";
import { AgreementTypeSelector } from "@/app/components/agreement-type-selector";

const statusLabel: Record<string, { text: string; className: string }> = {
  pending: { text: "Pending", className: "bg-stone-100 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300" },
  completed: { text: "Completed", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300" },
  in_progress: { text: "In progress", className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300" },
  sent: { text: "Sent", className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300" },
  signed: { text: "Signed", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300" },
  declined: { text: "Declined", className: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300" },
  delivered: { text: "Delivered", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300" },
  queued: { text: "Queued", className: "bg-stone-100 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300" },
  scheduled: { text: "Scheduled", className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300" },
  active: { text: "Active", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300" },
  expired: { text: "Expired", className: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300" },
  revoked: { text: "Revoked", className: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300" },
};

function StatusBadge({ status }: { status: string }) {
  const def = statusLabel[status] ?? {
    text: status,
    className: "bg-stone-100 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${def.className}`}>
      {def.text}
    </span>
  );
}

export function StepActionPanel({
  step,
  assignmentId,
  contracts,
  walkthroughs,
  welcomeMessages,
  shareLink,
  clientName,
  projectName,
}: Readonly<{
  step: OnboardingStepSummary;
  assignmentId: string;
  contracts: ClientContractSummary[];
  walkthroughs: ClientWalkthroughSummary[];
  welcomeMessages: ClientWelcomeMessageSummary[];
  shareLink: { id: string; status: string; expires_at: string | null; created_at: string } | null;
  clientName: string;
  projectName: string;
}>) {
  return (
    <WorkflowStep
      step={step}
      isLast
      assignmentId={assignmentId}
      contracts={contracts}
      walkthroughs={walkthroughs}
      welcomeMessages={welcomeMessages}
      shareLink={shareLink}
      clientName={clientName}
      projectName={projectName}
    />
  );
}

// ── Unified Workflow Timeline ────────────────────────────────
// Combines the progress bar, step timeline, and step actions
// into one cohesive view (replaces separate ProgressTimeline + StepActionPanel).

import { Loader2 } from "lucide-react";

const timelineStatusIcon = (status: string) => {
  if (status === "completed")
    return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  if (status === "in_progress")
    return <Loader2 className="h-5 w-5 animate-spin text-[var(--color-brand-primary)]" />;
  return <Circle className="h-5 w-5 text-stone-300 dark:text-zinc-600" />;
};

export function WorkflowTimeline({
  steps,
  progressPercent,
  assignmentId,
  contracts,
  walkthroughs,
  welcomeMessages,
  shareLink,
  clientName,
  projectName,
}: Readonly<{
  steps: OnboardingStepSummary[];
  progressPercent: number;
  assignmentId: string;
  contracts: ClientContractSummary[];
  walkthroughs: ClientWalkthroughSummary[];
  welcomeMessages: ClientWelcomeMessageSummary[];
  shareLink: { id: string; status: string; expires_at: string | null; created_at: string } | null;
  clientName: string;
  projectName: string;
}>) {
  if (steps.length === 0) {
    return (
      <p className="text-sm text-stone-500 dark:text-zinc-500">
        No onboarding steps created yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall progress bar */}
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-[var(--color-brand-primary)] transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="text-sm font-medium text-stone-700 dark:text-zinc-300">
          {progressPercent}%
        </span>
      </div>

      {/* Unified step list */}
      <ol className="relative space-y-0">
        {steps.map((step, index) => (
          <WorkflowStep
            key={step.id}
            step={step}
            isLast={index === steps.length - 1}
            assignmentId={assignmentId}
            contracts={contracts}
            walkthroughs={walkthroughs}
            welcomeMessages={welcomeMessages}
            shareLink={shareLink}
            clientName={clientName}
            projectName={projectName}
          />
        ))}
      </ol>
    </div>
  );
}

function WorkflowStep({
  step,
  isLast,
  assignmentId,
  contracts,
  walkthroughs,
  welcomeMessages,
  shareLink,
  clientName,
  projectName,
}: Readonly<{
  step: OnboardingStepSummary;
  isLast: boolean;
  assignmentId: string;
  contracts: ClientContractSummary[];
  walkthroughs: ClientWalkthroughSummary[];
  welcomeMessages: ClientWelcomeMessageSummary[];
  shareLink: { id: string; status: string; expires_at: string | null; created_at: string } | null;
  clientName: string;
  projectName: string;
}>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(step.status !== "completed");
  const [error, setError] = useState<string | null>(null);
  const [shareLinkResult, setShareLinkResult] = useState<string | null>(null);
  const [walkthroughLink, setWalkthroughLink] = useState<string | null>(null);
  const [showContractEditor, setShowContractEditor] = useState(false);
  const [editingContract, setEditingContract] = useState<ContractDetail | null>(null);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [selectedAgreementType, setSelectedAgreementType] = useState<AgreementType>("estate_sale");
  const [showByocForm, setShowByocForm] = useState(false);
  const [byocAgreementType, setByocAgreementType] = useState<AgreementType>("estate_sale");
  const [byocExternalContractUrl, setByocExternalContractUrl] = useState("");
  const [byocNotes, setByocNotes] = useState("");
  const isComplete = step.status === "completed";

  const stepKey = step.step_key;
  const showContract = stepKey === "contract_sent";
  const showWelcome = stepKey === "welcome_sent";
  const showWalkthrough = stepKey === "walkthrough_scheduled";
  const showShareLink = stepKey === "project_shared";

  const handleToggleStep = () => {
    setError(null);
    const formData = new FormData();
    formData.set("step_id", step.id);
    formData.set("status", isComplete ? "pending" : "completed");
    startTransition(async () => {
      const result = await updateOnboardingStepStatus(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch { /* noop */ }
  };

  const hasActions = showContract || showWelcome || showWalkthrough || showShareLink;

  return (
    <li className="flex gap-3">
      {/* Icon + connector line */}
      <div className="flex flex-col items-center">
        {timelineStatusIcon(step.status)}
        {!isLast && (
          <div className="w-px flex-1 bg-stone-200 dark:bg-zinc-700" />
        )}
      </div>

      {/* Step content */}
      <div className={`min-w-0 flex-1 ${isLast ? "" : "pb-5"}`}>
        {/* Step header row */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-2 text-left"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-stone-900 dark:text-white">
              {step.title}
            </p>
            <p className="text-xs text-stone-500 dark:text-zinc-500">
              {step.description}
            </p>
          </div>
          <StatusBadge status={step.status} />
          {hasActions && (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-stone-400 dark:text-zinc-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-stone-400 dark:text-zinc-500" />
            )
          )}
        </button>

        {step.completed_at && (
          <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
            Completed {new Date(step.completed_at).toLocaleDateString()}
          </p>
        )}

        {/* Expanded actions + artifacts */}
        {expanded && hasActions && (
          <div className="mt-3">
            {error && (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={handleToggleStep}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
              >
                {isComplete ? "Reopen step" : "Mark complete"}
              </button>

              {showContract && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setError(null);
                    setEditingContract(null);
                    setShowTypeSelector(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
                >
                  <FileSignature className="h-3.5 w-3.5" />
                  Create contract
                </button>
              )}

              {showContract && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setError(null);
                    setShowTypeSelector(false);
                    setShowContractEditor(false);
                    setByocAgreementType(selectedAgreementType);
                    setShowByocForm((value) => !value);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
                >
                  <FileSignature className="h-3.5 w-3.5" />
                  Bring your own contract
                </button>
              )}

              {showWelcome && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setError(null);
                    const fd = new FormData();
                    fd.set("assignment_id", assignmentId);
                    fd.set("subject", "Welcome to your estate sale project");
                    startTransition(async () => {
                      const res = await sendWelcomeEmail(fd);
                      if (res.error) { setError(res.error); return; }
                      router.refresh();
                    });
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Send welcome email
                </button>
              )}

              {showWalkthrough && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setError(null);
                    const fd = new FormData();
                    fd.set("assignment_id", assignmentId);
                    fd.set("provider", "calendly");
                    startTransition(async () => {
                      const res = await scheduleWalkthrough(fd);
                      if (res.error) { setError(res.error); return; }
                      if (res.data?.shareUrl) setWalkthroughLink(res.data.shareUrl);
                      router.refresh();
                    });
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Schedule walkthrough
                </button>
              )}

              {showShareLink && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setError(null);
                    const fd = new FormData();
                    fd.set("assignment_id", assignmentId);
                    startTransition(async () => {
                      const res = await createProjectShareLink(fd);
                      if (res.error) { setError(res.error); return; }
                      if (res.data?.shareUrl) setShareLinkResult(res.data.shareUrl);
                      router.refresh();
                    });
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Generate share link
                </button>
              )}

              {showShareLink && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setError(null);
                    const fd = new FormData();
                    fd.set("assignment_id", assignmentId);
                    startTransition(async () => {
                      const res = await sendClientPortalEmail(fd);
                      if (res.error) { setError(res.error); return; }
                      if (res.data?.shareUrl) setShareLinkResult(res.data.shareUrl);
                      router.refresh();
                    });
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
                >
                  <Send className="h-3.5 w-3.5" />
                  Email portal link
                </button>
              )}
            </div>

            {showContract && showByocForm && (
              <div className="mt-3 space-y-3 rounded-xl border border-stone-200 bg-stone-50/60 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
                <p className="text-xs font-medium text-stone-700 dark:text-zinc-300">
                  Record a client-provided signed contract
                </p>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs text-stone-600 dark:text-zinc-400">Agreement type</span>
                    <select
                      value={byocAgreementType}
                      onChange={(event) => setByocAgreementType(event.target.value as AgreementType)}
                      className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-xs text-stone-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                    >
                      <option value="estate_sale">Estate sale</option>
                      <option value="buyout">Buy out</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs text-stone-600 dark:text-zinc-400">Signed contract URL (optional)</span>
                    <input
                      type="url"
                      value={byocExternalContractUrl}
                      onChange={(event) => setByocExternalContractUrl(event.target.value)}
                      placeholder="https://..."
                      className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-xs text-stone-800 placeholder:text-stone-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:placeholder:text-zinc-500"
                    />
                  </label>
                </div>

                <label className="space-y-1">
                  <span className="text-xs text-stone-600 dark:text-zinc-400">Notes (optional)</span>
                  <textarea
                    value={byocNotes}
                    onChange={(event) => setByocNotes(event.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-xs text-stone-800 placeholder:text-stone-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:placeholder:text-zinc-500"
                    placeholder="Add context about this signed agreement"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setError(null);

                      const trimmedUrl = byocExternalContractUrl.trim();
                      if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
                        setError("Signed contract URL must start with http:// or https://");
                        return;
                      }

                      const fd = new FormData();
                      fd.set("assignment_id", assignmentId);
                      fd.set("agreement_type", byocAgreementType);
                      fd.set("external_contract_url", trimmedUrl);
                      fd.set("notes", byocNotes.trim());

                      startTransition(async () => {
                        const res = await recordClientProvidedContract(fd);
                        if (res.error) {
                          setError(res.error);
                          return;
                        }

                        setShowByocForm(false);
                        setByocExternalContractUrl("");
                        setByocNotes("");
                        router.refresh();
                      });
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    Save provided contract
                  </button>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setShowByocForm(false);
                      setByocExternalContractUrl("");
                      setByocNotes("");
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Agreement type selector */}
            {showContract && showTypeSelector && !showContractEditor && (
              <AgreementTypeSelector
                onSelect={(type) => {
                  setSelectedAgreementType(type);
                  setShowTypeSelector(false);
                  setShowContractEditor(true);
                }}
                onCancel={() => setShowTypeSelector(false)}
              />
            )}

            {/* Contract editor modal */}
            {showContract && showContractEditor && (
              <ContractEditor
                assignmentId={assignmentId}
                agreementType={editingContract?.agreement_type ?? selectedAgreementType}
                contract={editingContract}
                clientName={clientName}
                projectName={projectName}
                onClose={() => {
                  setShowContractEditor(false);
                  setEditingContract(null);
                }}
              />
            )}

            {/* Existing contracts */}
            {showContract && !showContractEditor && contracts.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-stone-600 dark:text-zinc-400">Contracts</p>
                {contracts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50/50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
                    <div className="min-w-0">
                      <p className="text-xs text-stone-700 dark:text-zinc-300">
                        {c.signer_email ?? "No signer"} &middot; {c.provider}
                        {c.commission_rate != null && <> &middot; {c.commission_rate}% commission</>}
                      </p>
                      {c.external_contract_id?.startsWith("http") && (
                        <a
                          href={c.external_contract_id}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[var(--color-brand-primary)] hover:underline"
                        >
                          Open provided contract
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {c.status === "draft" && (
                        <>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => {
                              setError(null);
                              startTransition(async () => {
                                const res = await getContractDetail(c.id);
                                if (res.error || !res.data) {
                                  setError(res.error ?? "Failed to load contract.");
                                  return;
                                }
                                setEditingContract(res.data);
                                setShowContractEditor(true);
                              });
                            }}
                            className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 transition hover:text-[var(--color-brand-primary)] dark:text-zinc-500"
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => {
                              if (!confirm("Delete this draft contract?")) return;
                              setError(null);
                              startTransition(async () => {
                                const res = await deleteContractDraft(c.id);
                                if (res.error) { setError(res.error); return; }
                                router.refresh();
                              });
                            }}
                            className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 transition hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </>
                      )}
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Welcome messages */}
            {showWelcome && welcomeMessages.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-stone-600 dark:text-zinc-400">Welcome emails</p>
                {welcomeMessages.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50/50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
                    <p className="text-xs text-stone-700 dark:text-zinc-300">{m.subject}</p>
                    <StatusBadge status={m.status} />
                  </div>
                ))}
              </div>
            )}

            {/* Walkthroughs */}
            {showWalkthrough && walkthroughs.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-stone-600 dark:text-zinc-400">Walkthroughs</p>
                {walkthroughs.map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50/50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
                    <div className="min-w-0">
                      <p className="text-xs text-stone-700 dark:text-zinc-300">
                        {w.provider}
                        {w.scheduled_start_at && <> &middot; {new Date(w.scheduled_start_at).toLocaleString()}</>}
                      </p>
                      {w.meeting_url && (
                        <a href={w.meeting_url} target="_blank" rel="noreferrer" className="text-xs text-[var(--color-brand-primary)] hover:underline">
                          Open meeting link
                        </a>
                      )}
                    </div>
                    <StatusBadge status={w.status} />
                  </div>
                ))}
              </div>
            )}

            {/* Share link */}
            {showShareLink && shareLink && (
              <div className="mt-3 rounded-xl border border-stone-100 bg-stone-50/50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
                <p className="text-xs text-stone-600 dark:text-zinc-400">
                  Existing link: <StatusBadge status={shareLink.status} />
                  {shareLink.expires_at && <> &middot; expires {new Date(shareLink.expires_at).toLocaleDateString()}</>}
                </p>
              </div>
            )}

            {/* Inline results */}
            {shareLinkResult && (
              <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Share link ready</p>
                <p className="mt-1 break-all text-xs text-emerald-700/90 dark:text-emerald-300/90">{shareLinkResult}</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => handleCopy(shareLinkResult)} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                  <a href={shareLinkResult} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                    <ExternalLink className="h-3 w-3" /> Open
                  </a>
                </div>
              </div>
            )}

            {walkthroughLink && (
              <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Scheduling link ready</p>
                <p className="mt-1 break-all text-xs text-indigo-700/90 dark:text-indigo-300/90">{walkthroughLink}</p>
                <button type="button" onClick={() => handleCopy(walkthroughLink)} className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300">
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
