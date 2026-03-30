"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Circle,
  Copy,
  ExternalLink,
  FileSignature,
  Link2,
  Mail,
  MapPin,
  Send,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

import type { OnboardingDashboardData } from "@/app/onboarding/actions";
import type { AgreementType } from "@/lib/agreement-types";
import {
  assignClientToProject,
  createClientProfile,
  createProjectShareLink,
  scheduleWalkthrough,
  createContractDraft,
  sendClientPortalEmail,
  sendWelcomeEmail,
  updateOnboardingStepStatus,
} from "@/app/onboarding/actions";
import {
  AddressAutocomplete,
  US_STATES,
  type AddressParts,
} from "@/app/components/address-autocomplete";
import { AgreementTypeSelector } from "@/app/components/agreement-type-selector";

type ShareResultState = Record<
  string,
  {
    url: string;
    expiresAt: string | null;
  }
>;

export function OnboardingConsole({
  initialData,
}: Readonly<{
  initialData: OnboardingDashboardData;
}>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createError, setCreateError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [shareResults, setShareResults] = useState<ShareResultState>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [contractSelectorFor, setContractSelectorFor] = useState<string | null>(null);
  const [showAddress, setShowAddress] = useState(false);
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");

  const handleAddressSelect = useCallback((parts: AddressParts) => {
    setAddressLine1(parts.address_line1);
    setAddressLine2(parts.address_line2);
    setCity(parts.city);
    setState(parts.state);
    setZipCode(parts.zip_code);
  }, []);

  const resetAddressFields = () => {
    setAddressLine1("");
    setAddressLine2("");
    setCity("");
    setState("");
    setZipCode("");
    setShowAddress(false);
  };

  const totalAssignments = initialData.assignments.length;
  const completedAssignments = initialData.assignments.filter(
    (assignment) => assignment.progressPercent === 100,
  ).length;

  const handleCreateClient = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    // Append address fields from controlled state
    formData.set("address_line1", addressLine1);
    formData.set("address_line2", addressLine2);
    formData.set("city", city);
    formData.set("state", state);
    formData.set("zip_code", zipCode);

    startTransition(async () => {
      const result = await createClientProfile(formData);
      if (result.error) {
        setCreateError(result.error);
        return;
      }

      form.reset();
      resetAddressFields();
      router.refresh();
    });
  };

  const handleAssignClient = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAssignError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await assignClientToProject(formData);
      if (result.error) {
        setAssignError(result.error);
        return;
      }

      form.reset();
      router.refresh();
    });
  };

  const handleToggleStep = (stepId: string, nextStatus: "pending" | "completed") => {
    setActionError(null);

    const formData = new FormData();
    formData.set("step_id", stepId);
    formData.set("status", nextStatus);

    startTransition(async () => {
      const result = await updateOnboardingStepStatus(formData);
      if (result.error) {
        setActionError(result.error);
        return;
      }

      router.refresh();
    });
  };

  const handleCreateShareLink = (assignmentId: string) => {
    setActionError(null);

    const formData = new FormData();
    formData.set("assignment_id", assignmentId);

    startTransition(async () => {
      const result = await createProjectShareLink(formData);
      if (result.error) {
        setActionError(result.error);
        return;
      }

      const shareUrl = result.data?.shareUrl;
      if (shareUrl) {
        setShareResults((current) => ({
          ...current,
          [assignmentId]: {
            url: shareUrl,
            expiresAt: result.data?.expiresAt ?? null,
          },
        }));
      }
    });
  };

  const handleSendPortalEmail = (assignmentId: string) => {
    setActionError(null);

    const formData = new FormData();
    formData.set("assignment_id", assignmentId);

    startTransition(async () => {
      const result = await sendClientPortalEmail(formData);
      if (result.error) {
        setActionError(result.error);
        return;
      }

      const shareUrl = result.data?.shareUrl;
      if (shareUrl) {
        setShareResults((current) => ({
          ...current,
          [assignmentId]: {
            url: shareUrl,
            expiresAt: result.data?.expiresAt ?? null,
          },
        }));
      }
      router.refresh();
    });
  };

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      setActionError("Copy failed. You can still open the link manually.");
    }
  };

  const handleCreateContract = (assignmentId: string, agreementType: AgreementType) => {
    setActionError(null);

    const formData = new FormData();
    formData.set("assignment_id", assignmentId);
    formData.set("provider", "manual");
    formData.set("agreement_type", agreementType);

    startTransition(async () => {
      const result = await createContractDraft(formData);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const handleSendWelcome = (assignmentId: string) => {
    setActionError(null);

    const formData = new FormData();
    formData.set("assignment_id", assignmentId);
    formData.set("subject", "Welcome to your estate sale project");

    startTransition(async () => {
      const result = await sendWelcomeEmail(formData);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const handleScheduleWalkthrough = (assignmentId: string, provider: string) => {
    setActionError(null);

    const formData = new FormData();
    formData.set("assignment_id", assignmentId);
    formData.set("provider", provider);

    startTransition(async () => {
      const result = await scheduleWalkthrough(formData);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      if (result.data?.shareUrl) {
        setShareResults((current) => ({
          ...current,
          [`walkthrough_${assignmentId}`]: {
            url: result.data!.shareUrl!,
            expiresAt: null,
          },
        }));
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[var(--color-brand-subtle)] p-2 text-[var(--color-brand-primary)]">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-stone-500 dark:text-zinc-500">Clients</p>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">
                {initialData.clients.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-stone-500 dark:text-zinc-500">Active assignments</p>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">
                {totalAssignments}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-50 p-2 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-stone-500 dark:text-zinc-500">Ready workflows</p>
              <p className="text-2xl font-bold text-stone-900 dark:text-white">
                {completedAssignments}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-[var(--color-brand-subtle)] p-2 text-[var(--color-brand-primary)]">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-stone-900 dark:text-white">
                  Add client
                </h2>
                <p className="text-sm text-stone-500 dark:text-zinc-500">
                  Create the client record before attaching them to a project.
                </p>
              </div>
            </div>

            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateClient}>
              <label className="text-sm font-medium text-stone-700 dark:text-zinc-300">
                Full name
                <input
                  required
                  name="full_name"
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none ring-0 transition focus:border-[var(--color-brand-primary)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                />
              </label>
              <label className="text-sm font-medium text-stone-700 dark:text-zinc-300">
                Email
                <input
                  required
                  type="email"
                  name="email"
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none ring-0 transition focus:border-[var(--color-brand-primary)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                />
              </label>
              <label className="text-sm font-medium text-stone-700 dark:text-zinc-300">
                Phone <span className="text-stone-400 dark:text-zinc-500">(optional)</span>
                <input
                  name="phone"
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none ring-0 transition focus:border-[var(--color-brand-primary)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                />
              </label>
              <label className="text-sm font-medium text-stone-700 dark:text-zinc-300 md:col-span-2">
                Notes <span className="text-stone-400 dark:text-zinc-500">(optional)</span>
                <textarea
                  rows={3}
                  name="notes"
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none ring-0 transition focus:border-[var(--color-brand-primary)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                />
              </label>

              {/* Progressive disclosure: address section */}
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={() => setShowAddress((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-brand-primary)] transition hover:opacity-80"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {showAddress ? "Hide address" : "Add address (optional)"}
                  <ChevronDown className={`h-3.5 w-3.5 transition ${showAddress ? "rotate-180" : ""}`} />
                </button>

                {showAddress && (
                  <div className="mt-3 space-y-3 rounded-xl border border-stone-100 bg-stone-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor="onb-address1" className="text-xs font-medium text-stone-600 dark:text-zinc-400">
                          Street address
                        </label>
                        <AddressAutocomplete
                          id="onb-address1"
                          value={addressLine1}
                          onChange={setAddressLine1}
                          onSelect={handleAddressSelect}
                          placeholder="Start typing an address…"
                          disabled={isPending}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label htmlFor="onb-address2" className="text-xs font-medium text-stone-600 dark:text-zinc-400">
                          Suite / unit <span className="text-stone-400 dark:text-zinc-500">(optional)</span>
                        </label>
                        <input
                          id="onb-address2"
                          type="text"
                          value={addressLine2}
                          onChange={(e) => setAddressLine2(e.target.value)}
                          placeholder="Suite 200"
                          disabled={isPending}
                          className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none ring-0 transition focus:border-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="onb-city" className="text-xs font-medium text-stone-600 dark:text-zinc-400">City</label>
                        <input
                          id="onb-city"
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="Springfield"
                          disabled={isPending}
                          className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none ring-0 transition focus:border-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                        />
                      </div>
                      <div>
                        <label htmlFor="onb-state" className="text-xs font-medium text-stone-600 dark:text-zinc-400">State</label>
                        <select
                          id="onb-state"
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          disabled={isPending}
                          className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                        >
                          {US_STATES.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="onb-zip" className="text-xs font-medium text-stone-600 dark:text-zinc-400">ZIP</label>
                        <input
                          id="onb-zip"
                          type="text"
                          inputMode="numeric"
                          maxLength={10}
                          value={zipCode}
                          onChange={(e) => setZipCode(e.target.value)}
                          placeholder="62704"
                          disabled={isPending}
                          className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none ring-0 transition focus:border-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="md:col-span-2 flex items-center justify-between gap-3">
                <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-primary)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Mail className="h-4 w-4" />
                  Create client
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                <Link2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-stone-900 dark:text-white">
                  Assign project
                </h2>
                <p className="text-sm text-stone-500 dark:text-zinc-500">
                  Attach a client to a project and generate the default onboarding checklist.
                </p>
              </div>
            </div>

            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleAssignClient}>
              <label className="text-sm font-medium text-stone-700 dark:text-zinc-300">
                Client
                <select
                  required
                  name="client_profile_id"
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-[var(--color-brand-primary)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select a client
                  </option>
                  {initialData.clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.full_name} ({client.email})
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-stone-700 dark:text-zinc-300">
                Project
                <select
                  required
                  name="project_id"
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-[var(--color-brand-primary)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select a project
                  </option>
                  {initialData.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                      {project.published ? " • published" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="md:col-span-2 flex items-center justify-between gap-3">
                <p className="text-sm text-red-600 dark:text-red-400">{assignError}</p>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-primary)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Users className="h-4 w-4" />
                  Create assignment
                </button>
              </div>
            </form>
          </section>
        </div>

        <section className="rounded-3xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-stone-900 dark:text-white">
                Active onboarding
              </h2>
              <p className="text-sm text-stone-500 dark:text-zinc-500">
                Manage progress, share links, and client-facing transparency from one place.
              </p>
            </div>
          </div>

          {actionError ? (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {actionError}
            </div>
          ) : null}

          <div className="space-y-4">
            {initialData.assignments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500 dark:border-zinc-700 dark:text-zinc-500">
                No client assignments yet.
              </div>
            ) : (
              initialData.assignments.map((assignment) => {
                const shareResult = shareResults[assignment.id];

                return (
                  <article
                    key={assignment.id}
                    className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/70"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-stone-900 dark:text-white">
                          {assignment.client.full_name}
                        </p>
                        <p className="text-sm text-stone-500 dark:text-zinc-500">
                          {assignment.client.email} • {assignment.project.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-zinc-500">
                          Progress
                        </p>
                        <p className="text-lg font-semibold text-stone-900 dark:text-white">
                          {assignment.progressPercent}%
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                        <p className="text-stone-500 dark:text-zinc-500">Inventory</p>
                        <p className="font-semibold text-stone-900 dark:text-white">
                          {assignment.inventoryCount} items
                        </p>
                      </div>
                      <div className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                        <p className="text-stone-500 dark:text-zinc-500">Available</p>
                        <p className="font-semibold text-stone-900 dark:text-white">
                          {assignment.availableCount}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                        <p className="text-stone-500 dark:text-zinc-500">Sold</p>
                        <p className="font-semibold text-stone-900 dark:text-white">
                          {assignment.soldCount}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {assignment.steps.map((step) => {
                        const isComplete = step.status === "completed";

                        return (
                          <div
                            key={step.id}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900"
                          >
                            <div className="flex items-start gap-3">
                              {isComplete ? (
                                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
                              ) : (
                                <Circle className="mt-0.5 h-5 w-5 text-stone-300 dark:text-zinc-600" />
                              )}
                              <div>
                                <p className="text-sm font-medium text-stone-900 dark:text-white">
                                  {step.title}
                                </p>
                                <p className="text-xs text-stone-500 dark:text-zinc-500">
                                  {step.description}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() =>
                                handleToggleStep(step.id, isComplete ? "pending" : "completed")
                              }
                              className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 transition hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] dark:border-zinc-700 dark:text-zinc-300"
                            >
                              {isComplete ? "Reopen" : "Mark complete"}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <p className="mb-3 text-sm font-medium text-stone-900 dark:text-white">
                        Quick actions
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setContractSelectorFor(assignment.id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 transition hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
                        >
                          <FileSignature className="h-3.5 w-3.5" />
                          Create contract
                        </button>
                        {contractSelectorFor === assignment.id && (
                          <AgreementTypeSelector
                            onSelect={(type) => {
                              setContractSelectorFor(null);
                              handleCreateContract(assignment.id, type);
                            }}
                            onCancel={() => setContractSelectorFor(null)}
                          />
                        )}
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleSendWelcome(assignment.id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 transition hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          Send welcome email
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleScheduleWalkthrough(assignment.id, "calendly")}
                          className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 transition hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
                        >
                          <Calendar className="h-3.5 w-3.5" />
                          Schedule walkthrough
                        </button>
                      </div>

                      {shareResults[`walkthrough_${assignment.id}`] ? (
                        <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                          <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                            Scheduling link ready
                          </p>
                          <p className="mt-1 break-all text-xs text-indigo-700/90 dark:text-indigo-300/90">
                            {shareResults[`walkthrough_${assignment.id}`].url}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(shareResults[`walkthrough_${assignment.id}`].url)
                            }
                            className="mt-2 inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-medium text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copy scheduling link
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-stone-900 dark:text-white">
                            Client transparency link
                          </p>
                          <p className="text-xs text-stone-500 dark:text-zinc-500">
                            Generate a one-time link and share it directly with the client.
                          </p>
                          {assignment.shareLink ? (
                            <p className="mt-1 text-xs text-stone-500 dark:text-zinc-500">
                              Current link status: {assignment.shareLink.status}
                              {assignment.shareLink.expires_at
                                ? ` • expires ${new Date(assignment.shareLink.expires_at).toLocaleDateString()}`
                                : ""}
                            </p>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleCreateShareLink(assignment.id)}
                          className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-primary)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Link2 className="h-4 w-4" />
                          Generate link
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleSendPortalEmail(assignment.id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
                        >
                          <Send className="h-4 w-4" />
                          Email portal link
                        </button>
                      </div>

                      {shareResult ? (
                        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                            Share link ready
                          </p>
                          <p className="mt-1 break-all text-xs text-emerald-700/90 dark:text-emerald-300/90">
                            {shareResult.url}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopy(shareResult.url)}
                              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copy link
                            </button>
                            <a
                              href={shareResult.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open portal
                            </a>
                          </div>
                          <p className="mt-2 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                            Visible once here. Expires {shareResult.expiresAt ? new Date(shareResult.expiresAt).toLocaleString() : "automatically"}.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}