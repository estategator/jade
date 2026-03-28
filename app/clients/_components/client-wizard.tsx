"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  Link as LinkIcon,
  MapPin,
  Package,
  Pencil,
  Save,
  Trash2,
  Unlink,
  X,
} from "lucide-react";

import type {
  ClientAssignmentDetail,
  OnboardingClientProfile,
  OnboardingProjectOption,
} from "@/app/onboarding/actions";
import {
  assignClientToProject,
  changeClientAssignment,
  deleteClientProfile,
  removeClientAssignment,
  updateClientProfile,
} from "@/app/onboarding/actions";
import {
  AddressAutocomplete,
  US_STATES,
  type AddressParts,
} from "@/app/components/address-autocomplete";

import { WorkflowTimeline } from "./step-action-panel";

const stageBadge: Record<string, { text: string; className: string }> = {
  invited: { text: "Invited", className: "bg-stone-100 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300" },
  onboarding: { text: "Onboarding", className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300" },
  active: { text: "Active", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300" },
  completed: { text: "Completed", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300" },
  archived: { text: "Archived", className: "bg-stone-100 text-stone-500 dark:bg-zinc-800 dark:text-zinc-500" },
};

function StageBadge({ stage }: { stage: string }) {
  const def = stageBadge[stage] ?? {
    text: stage,
    className: "bg-stone-100 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${def.className}`}>
      {def.text}
    </span>
  );
}

function AssignmentAccordion({
  assignment,
  clientName,
  projects,
  isPending,
  onRemove,
  onChange,
}: Readonly<{
  assignment: ClientAssignmentDetail;
  clientName: string;
  projects: OnboardingProjectOption[];
  isPending: boolean;
  onRemove: (assignmentId: string) => void;
  onChange: (assignmentId: string, newProjectId: string) => void;
}>) {
  const [expanded, setExpanded] = useState(true);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [changeProjectId, setChangeProjectId] = useState("");

  const isArchived = assignment.status === "archived";

  // Filter out projects already assigned (including current)
  const availableProjects = useMemo(
    () => projects.filter((p) => p.id !== assignment.project.id),
    [projects, assignment.project.id],
  );

  return (
    <>
      <article
        className={`rounded-3xl border bg-white dark:bg-zinc-900 ${
          isArchived
            ? "border-stone-100 opacity-70 dark:border-zinc-800/60"
            : "border-stone-200 dark:border-zinc-800"
        }`}
      >
        {/* Header */}
        <div className="flex w-full items-center gap-4 px-6 py-5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex flex-1 items-center gap-4 text-left"
          >
            <div className={`rounded-xl p-2 ${
              isArchived
                ? "bg-stone-100 text-stone-400 dark:bg-zinc-800 dark:text-zinc-500"
                : "bg-[var(--color-brand-subtle)] text-[var(--color-brand-primary)]"
            }`}>
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-stone-900 dark:text-white">
                {assignment.project.name}
              </p>
              <p className="text-sm text-stone-500 dark:text-zinc-500">
                {isArchived ? "Archived" : "Assigned"}{" "}
                {new Date(assignment.assigned_at).toLocaleDateString()}
              </p>
            </div>
            <StageBadge stage={isArchived ? "archived" : assignment.stage} />
            {expanded ? (
              <ChevronDown className="h-5 w-5 text-stone-400 dark:text-zinc-500" />
            ) : (
              <ChevronRight className="h-5 w-5 text-stone-400 dark:text-zinc-500" />
            )}
          </button>

          {/* Action buttons for active assignments */}
          {!isArchived && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setChangeProjectId("");
                  setShowChangeModal(true);
                }}
                title="Change project"
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-2.5 py-2 text-xs font-medium text-stone-600 transition hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-indigo-700 dark:hover:text-indigo-400"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Change</span>
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setShowRemoveConfirm(true)}
                title="Remove assignment"
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-2.5 py-2 text-xs font-medium text-stone-600 transition hover:border-red-300 hover:text-red-600 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-red-800 dark:hover:text-red-400"
              >
                <Unlink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Remove</span>
              </button>
            </div>
          )}
        </div>

        {expanded && (
          <div className="border-t border-stone-100 px-6 py-5 dark:border-zinc-800">
            {/* Inventory stats */}
            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-3 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/70">
                <p className="text-stone-500 dark:text-zinc-500">Inventory</p>
                <p className="font-semibold text-stone-900 dark:text-white">
                  {assignment.inventoryCount} items
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-3 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/70">
                <p className="text-stone-500 dark:text-zinc-500">Available</p>
                <p className="font-semibold text-stone-900 dark:text-white">
                  {assignment.availableCount}
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-3 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/70">
                <p className="text-stone-500 dark:text-zinc-500">Sold</p>
                <p className="font-semibold text-stone-900 dark:text-white">
                  {assignment.soldCount}
                </p>
              </div>
            </div>

            {/* Unified workflow timeline with actions */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-stone-800 dark:text-zinc-200">
                Workflow
              </h3>
              <WorkflowTimeline
                steps={assignment.steps}
                progressPercent={assignment.progressPercent}
                assignmentId={assignment.id}
                contracts={assignment.contracts}
                walkthroughs={assignment.walkthroughs}
                welcomeMessages={assignment.welcomeMessages}
                shareLink={assignment.shareLink}
                clientName={clientName}
                projectName={assignment.project.name}
              />
            </div>
          </div>
        )}
      </article>

      {/* ── Remove confirmation modal ── */}
      <AnimatePresence>
        {showRemoveConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => { if (!isPending) setShowRemoveConfirm(false); }}
            role="dialog"
            aria-modal="true"
            aria-label="Remove assignment"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                    Remove assignment
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRemoveConfirm(false)}
                  disabled={isPending}
                  className="rounded-lg p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                <p className="text-sm text-stone-700 dark:text-zinc-300">
                  This will remove <strong>{assignment.project.name}</strong> from{" "}
                  <strong>{clientName}</strong>. The project will become available
                  for reassignment. All workflow history is preserved.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRemoveConfirm(false)}
                  disabled={isPending}
                  className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    onRemove(assignment.id);
                    setShowRemoveConfirm(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-700 dark:hover:bg-red-800"
                >
                  <Unlink className="h-4 w-4" />
                  Remove
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Change project modal ── */}
      <AnimatePresence>
        {showChangeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => { if (!isPending) setShowChangeModal(false); }}
            role="dialog"
            aria-modal="true"
            aria-label="Change project assignment"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                    <ArrowRightLeft className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                      Change project
                    </h2>
                    <p className="text-sm text-stone-500 dark:text-zinc-500">
                      Currently: {assignment.project.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowChangeModal(false)}
                  disabled={isPending}
                  className="rounded-lg p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
                The current assignment will be archived and a new onboarding
                workflow will start for the selected project.
              </div>

              <label className="mb-4 block text-sm font-medium text-stone-700 dark:text-zinc-300">
                New project
                <select
                  value={changeProjectId}
                  onChange={(e) => setChangeProjectId(e.target.value)}
                  disabled={isPending}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-[var(--color-brand-primary)] disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                >
                  <option value="" disabled>Select a project</option>
                  {availableProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.published ? " \u2022 published" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowChangeModal(false)}
                  disabled={isPending}
                  className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPending || !changeProjectId}
                  onClick={() => {
                    onChange(assignment.id, changeProjectId);
                    setShowChangeModal(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-primary)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Change
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function ClientWizard({
  client,
  projects,
  assignments,
}: Readonly<{
  client: OnboardingClientProfile;
  projects: OnboardingProjectOption[];
  assignments: ClientAssignmentDetail[];
}>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const activeAssignments = useMemo(
    () => assignments.filter((a) => a.status === "active"),
    [assignments],
  );
  const archivedAssignments = useMemo(
    () => assignments.filter((a) => a.status === "archived"),
    [assignments],
  );
  const [showArchived, setShowArchived] = useState(false);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(client.full_name);
  const [editEmail, setEditEmail] = useState(client.email);
  const [editPhone, setEditPhone] = useState(client.phone ?? "");
  const [editNotes, setEditNotes] = useState(client.notes);
  const [editAddressLine1, setEditAddressLine1] = useState(client.address_line1 ?? "");
  const [editAddressLine2, setEditAddressLine2] = useState(client.address_line2 ?? "");
  const [editCity, setEditCity] = useState(client.city ?? "");
  const [editState, setEditState] = useState(client.state ?? "");
  const [editZipCode, setEditZipCode] = useState(client.zip_code ?? "");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);

  const handleAddressSelect = useCallback((parts: AddressParts) => {
    setEditAddressLine1(parts.address_line1);
    setEditAddressLine2(parts.address_line2);
    setEditCity(parts.city);
    setEditState(parts.state);
    setEditZipCode(parts.zip_code);
  }, []);

  const handleCancelEdit = () => {
    setEditing(false);
    setEditError(null);
    setEditSuccess(false);
    setEditName(client.full_name);
    setEditEmail(client.email);
    setEditPhone(client.phone ?? "");
    setEditNotes(client.notes);
    setEditAddressLine1(client.address_line1 ?? "");
    setEditAddressLine2(client.address_line2 ?? "");
    setEditCity(client.city ?? "");
    setEditState(client.state ?? "");
    setEditZipCode(client.zip_code ?? "");
  };

  const handleSaveClient = () => {
    setEditError(null);
    setEditSuccess(false);

    const formData = new FormData();
    formData.set("full_name", editName);
    formData.set("email", editEmail);
    formData.set("phone", editPhone);
    formData.set("notes", editNotes);
    formData.set("address_line1", editAddressLine1);
    formData.set("address_line2", editAddressLine2);
    formData.set("city", editCity);
    formData.set("state", editState);
    formData.set("zip_code", editZipCode);

    startTransition(async () => {
      const result = await updateClientProfile(client.id, formData);
      if (result.error) {
        setEditError(result.error);
        return;
      }
      setEditSuccess(true);
      setEditing(false);
      setTimeout(() => setEditSuccess(false), 3000);
      router.refresh();
    });
  };

  const handleAssignProject = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAssignError(null);
    setAssignSuccess(false);
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("client_profile_id", client.id);

    startTransition(async () => {
      const result = await assignClientToProject(formData);
      if (result.error) {
        setAssignError(result.error);
        return;
      }
      form.reset();
      setAssignSuccess(true);
      setTimeout(() => setAssignSuccess(false), 3000);
      router.refresh();
    });
  };

  const handleRemoveAssignment = (assignmentId: string) => {
    setActionError(null);
    startTransition(async () => {
      const result = await removeClientAssignment(assignmentId);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const handleChangeAssignment = (assignmentId: string, newProjectId: string) => {
    setActionError(null);
    startTransition(async () => {
      const result = await changeClientAssignment(assignmentId, newProjectId);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="mt-6 space-y-6">
      {/* Client info card */}
      <section className="rounded-3xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        {editError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400">
            {editError}
          </div>
        )}
        {editSuccess && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-400">
            Client updated successfully.
          </div>
        )}

        {editing ? (
          /* ── Edit mode ── */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-900 dark:text-white">Edit client</h2>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 transition hover:border-red-300 hover:text-red-600 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-400"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-stone-700 dark:text-zinc-300">
                Full name
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={isPending}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none ring-0 transition focus:border-[var(--color-brand-primary)] disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                />
              </label>
              <label className="text-sm font-medium text-stone-700 dark:text-zinc-300">
                Email
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  disabled={isPending}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none ring-0 transition focus:border-[var(--color-brand-primary)] disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                />
              </label>
              <label className="text-sm font-medium text-stone-700 dark:text-zinc-300">
                Phone <span className="text-stone-400 dark:text-zinc-500">(optional)</span>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  disabled={isPending}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none ring-0 transition focus:border-[var(--color-brand-primary)] disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                />
              </label>
              <label className="text-sm font-medium text-stone-700 dark:text-zinc-300 sm:col-span-2">
                Notes <span className="text-stone-400 dark:text-zinc-500">(optional)</span>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  disabled={isPending}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none ring-0 transition focus:border-[var(--color-brand-primary)] disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                />
              </label>
            </div>

            {/* Address section */}
            <div className="space-y-3 rounded-xl border border-stone-100 bg-stone-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
              <p className="flex items-center gap-1.5 text-sm font-medium text-stone-700 dark:text-zinc-300">
                <MapPin className="h-3.5 w-3.5" />
                Address <span className="text-stone-400 dark:text-zinc-500">(optional)</span>
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit-address1" className="text-xs font-medium text-stone-600 dark:text-zinc-400">
                    Street address
                  </label>
                  <AddressAutocomplete
                    id="edit-address1"
                    value={editAddressLine1}
                    onChange={setEditAddressLine1}
                    onSelect={handleAddressSelect}
                    placeholder="Start typing an address…"
                    disabled={isPending}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label htmlFor="edit-address2" className="text-xs font-medium text-stone-600 dark:text-zinc-400">
                    Suite / unit <span className="text-stone-400 dark:text-zinc-500">(optional)</span>
                  </label>
                  <input
                    id="edit-address2"
                    type="text"
                    value={editAddressLine2}
                    onChange={(e) => setEditAddressLine2(e.target.value)}
                    placeholder="Suite 200"
                    disabled={isPending}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none ring-0 transition focus:border-[var(--color-brand-primary)] disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="edit-city" className="text-xs font-medium text-stone-600 dark:text-zinc-400">City</label>
                  <input
                    id="edit-city"
                    type="text"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    placeholder="Springfield"
                    disabled={isPending}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none ring-0 transition focus:border-[var(--color-brand-primary)] disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="edit-state" className="text-xs font-medium text-stone-600 dark:text-zinc-400">State</label>
                  <select
                    id="edit-state"
                    value={editState}
                    onChange={(e) => setEditState(e.target.value)}
                    disabled={isPending}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-[var(--color-brand-primary)] disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                  >
                    {US_STATES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-zip" className="text-xs font-medium text-stone-600 dark:text-zinc-400">ZIP</label>
                  <input
                    id="edit-zip"
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    value={editZipCode}
                    onChange={(e) => setEditZipCode(e.target.value)}
                    placeholder="62704"
                    disabled={isPending}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none ring-0 transition focus:border-[var(--color-brand-primary)] disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveClient}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-primary)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                Save changes
              </button>
            </div>
          </div>
        ) : (
          /* ── Read mode ── */
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-brand-subtle)] text-lg font-bold text-[var(--color-brand-primary)]">
                  {client.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-semibold text-stone-900 dark:text-white">{client.full_name}</p>
                  <p className="text-sm text-stone-500 dark:text-zinc-500">
                    {client.email}
                    {client.phone && <> &middot; {client.phone}</>}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 transition hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] dark:border-zinc-700 dark:text-zinc-400"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  if (!confirm(`Delete ${client.full_name}? This will permanently remove the client and all their assignments, contracts, and workflow data. This cannot be undone.`)) return;
                  startTransition(async () => {
                    const res = await deleteClientProfile(client.id);
                    if (res.error) {
                      setEditError(res.error);
                      return;
                    }
                    router.push('/clients');
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 transition hover:border-red-300 hover:text-red-600 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-red-800 dark:hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
            {client.address_line1 && (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-stone-500 dark:text-zinc-500">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {[client.address_line1, client.address_line2, client.city, client.state, client.zip_code]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
            {client.notes && (
              <p className="mt-4 rounded-2xl border border-stone-100 bg-stone-50/50 px-4 py-3 text-sm text-stone-700 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
                {client.notes}
              </p>
            )}
            <p className="mt-3 text-xs text-stone-400 dark:text-zinc-600">
              Client since {new Date(client.created_at).toLocaleDateString()}
            </p>
          </>
        )}
      </section>

      {/* Attach project */}
      <section className="rounded-3xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
            <LinkIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-white">Attach project</h2>
            <p className="text-sm text-stone-500 dark:text-zinc-500">
              Link this client to a project to start the onboarding workflow.
            </p>
          </div>
        </div>

        {assignSuccess && (
          <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-400">
            Project attached successfully.
          </div>
        )}

        <form className="flex flex-wrap items-end gap-3" onSubmit={handleAssignProject}>
          <label className="flex-1 text-sm font-medium text-stone-700 dark:text-zinc-300">
            Project
            <select
              required
              name="project_id"
              className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-[var(--color-brand-primary)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              defaultValue=""
            >
              <option value="" disabled>Select a project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.published ? " \u2022 published" : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-primary)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LinkIcon className="h-4 w-4" />
            Attach
          </button>
          {assignError && (
            <p className="w-full text-sm text-red-600 dark:text-red-400">{assignError}</p>
          )}
        </form>
      </section>

      {/* Action-level error */}
      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400">
          {actionError}
        </div>
      )}

      {/* Active assignments */}
      {activeAssignments.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-stone-300 px-6 py-12 text-center dark:border-zinc-700">
          <LinkIcon className="mx-auto mb-3 h-8 w-8 text-stone-300 dark:text-zinc-600" />
          <p className="text-sm font-medium text-stone-500 dark:text-zinc-500">
            No active project assignments
          </p>
          <p className="mt-1 text-xs text-stone-400 dark:text-zinc-600">
            Attach a project above to begin onboarding.
          </p>
        </div>
      ) : (
        activeAssignments.map((a) => (
          <AssignmentAccordion
            key={a.id}
            assignment={a}
            clientName={client.full_name}
            projects={projects}
            isPending={isPending}
            onRemove={handleRemoveAssignment}
            onChange={handleChangeAssignment}
          />
        ))
      )}

      {/* Archived assignments (collapsed by default) */}
      {archivedAssignments.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-stone-500 transition hover:text-stone-700 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            {showArchived ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Archived assignments ({archivedAssignments.length})
          </button>
          {showArchived && (
            <div className="space-y-4">
              {archivedAssignments.map((a) => (
                <AssignmentAccordion
                  key={a.id}
                  assignment={a}
                  clientName={client.full_name}
                  projects={projects}
                  isPending={isPending}
                  onRemove={handleRemoveAssignment}
                  onChange={handleChangeAssignment}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
