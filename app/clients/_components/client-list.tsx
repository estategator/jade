"use client";

import { useState, useTransition, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  DollarSign,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import type {
  OnboardingDashboardData,
  OnboardingClientProfile,
  FrequentBuyerSuggestion,
} from "@/app/onboarding/actions";
import {
  createClientProfile,
  toggleStarClientProfile,
  acceptFrequentBuyerSuggestion,
  dismissFrequentBuyerSuggestion,
  notifyFrequentClients,
} from "@/app/onboarding/actions";
import {
  AddressAutocomplete,
  US_STATES,
  type AddressParts,
} from "@/app/components/address-autocomplete";
import { Modal } from "@/app/components/ui/modal";

type ClientTab = 'all' | 'frequents';

export function ClientList({
  initialData,
  suggestions,
}: Readonly<{
  initialData: OnboardingDashboardData;
  suggestions: FrequentBuyerSuggestion[];
}>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createError, setCreateError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddress, setShowAddress] = useState(false);
  const [activeTab, setActiveTab] = useState<ClientTab>('all');
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [createSuccess, setCreateSuccess] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const totalAssignments = initialData.assignments.length;
  const completedAssignments = initialData.assignments.filter(
    (a) => a.progressPercent === 100,
  ).length;

  const starredClients = useMemo(
    () => initialData.clients.filter((c) => c.is_starred),
    [initialData.clients],
  );

  const filteredClients = useMemo(() => {
    const baseList = activeTab === 'frequents' ? starredClients : initialData.clients;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return baseList;
    return baseList.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.state && c.state.toLowerCase().includes(q)) ||
        (c.address_line1 && c.address_line1.toLowerCase().includes(q)),
    );
  }, [searchQuery, initialData.clients, starredClients, activeTab]);

  const handleToggleStar = useCallback(
    (e: React.MouseEvent, clientId: string) => {
      e.preventDefault();
      e.stopPropagation();
      startTransition(async () => {
        await toggleStarClientProfile(clientId);
        router.refresh();
      });
    },
    [router, startTransition],
  );

  const handleAcceptSuggestion = useCallback(
    (suggestionId: string) => {
      startTransition(async () => {
        await acceptFrequentBuyerSuggestion(suggestionId);
        router.refresh();
      });
    },
    [router, startTransition],
  );

  const handleDismissSuggestion = useCallback(
    (suggestionId: string) => {
      startTransition(async () => {
        await dismissFrequentBuyerSuggestion(suggestionId);
        router.refresh();
      });
    },
    [router, startTransition],
  );

  // Map clients to their assignments for quick lookup
  const assignmentsByClient = useMemo(() => {
    const map = new Map<string, typeof initialData.assignments>();
    for (const a of initialData.assignments) {
      const arr = map.get(a.client.id) ?? [];
      arr.push(a);
      map.set(a.client.id, arr);
    }
    return map;
  }, [initialData.assignments]);

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

  const closeAddModal = useCallback(() => {
    setShowAddModal(false);
    setCreateError(null);
    setCreateSuccess(false);
    resetAddressFields();
  }, []);

  const handleCreateClient = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);
    setCreateSuccess(false);
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
      setCreateSuccess(true);
      setTimeout(() => setCreateSuccess(false), 3000);
      router.refresh();
      closeAddModal();
    });
  };

  return (
    <div className="space-y-8">
      {/* Stats row */}
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

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-2xl border border-stone-200 bg-stone-50 p-1 dark:border-zinc-800 dark:bg-zinc-950">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
            activeTab === 'all'
              ? 'bg-white text-stone-900 shadow-sm dark:bg-zinc-800 dark:text-white'
              : 'text-stone-500 hover:text-stone-700 dark:text-zinc-500 dark:hover:text-zinc-300'
          }`}
        >
          <Users className="h-4 w-4" />
          All Clients
          <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs dark:bg-zinc-700">
            {initialData.clients.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('frequents')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
            activeTab === 'frequents'
              ? 'bg-white text-stone-900 shadow-sm dark:bg-zinc-800 dark:text-white'
              : 'text-stone-500 hover:text-stone-700 dark:text-zinc-500 dark:hover:text-zinc-300'
          }`}
        >
          <Star className="h-4 w-4" />
          Frequents
          <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs dark:bg-zinc-700">
            {starredClients.length}
          </span>
        </button>
      </div>

      {/* Suggested Frequents panel */}
      {suggestions.length > 0 && (
        <SuggestedFrequentsPanel
          suggestions={suggestions}
          isPending={isPending}
          onAccept={handleAcceptSuggestion}
          onDismiss={handleDismissSuggestion}
        />
      )}

      <div className="space-y-6">
        {/* Search + buttons row */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Search by name, email, phone, or location…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm text-stone-900 outline-none transition focus:border-[var(--color-brand-primary)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            />
          </div>
          {activeTab === 'frequents' && starredClients.length > 0 && (
            <button
              type="button"
              onClick={() => setShowNotifyModal(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-medium text-stone-700 transition hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-[var(--color-brand-primary)]"
            >
              <Bell className="h-4 w-4" />
              Notify
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[var(--color-brand-primary)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--color-brand-primary-hover)]"
          >
            <UserPlus className="h-4 w-4" />
            Add client
          </button>
        </div>

          {filteredClients.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-stone-300 px-6 py-12 text-center text-sm text-stone-500 dark:border-zinc-700 dark:text-zinc-500">
              {searchQuery
                ? "No clients match your search."
                : activeTab === 'frequents'
                  ? "No starred clients yet. Star a client to add them here."
                  : "No clients yet. Click \"Add client\" to get started."}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredClients.map((client) => {
                const clientAssignments = assignmentsByClient.get(client.id) ?? [];
                const avgProgress =
                  clientAssignments.length > 0
                    ? Math.round(
                        clientAssignments.reduce((s, a) => s + a.progressPercent, 0) /
                          clientAssignments.length,
                      )
                    : 0;

                return (
                  <Link
                    key={client.id}
                    href={`/clients/${client.id}`}
                    className="group flex items-center gap-4 rounded-2xl border border-stone-200 bg-white px-5 py-4 transition hover:border-[var(--color-brand-primary)] hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-[var(--color-brand-primary)]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-subtle)] text-sm font-bold text-[var(--color-brand-primary)]">
                      {client.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-stone-900 dark:text-white">
                        {client.full_name}
                      </p>
                      <p className="truncate text-xs text-stone-500 dark:text-zinc-500">
                        {client.email}
                      </p>
                      {client.city && (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-stone-400 dark:text-zinc-600">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {[client.city, client.state].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="hidden items-center gap-3 sm:flex">
                      <span className="text-xs text-stone-500 dark:text-zinc-500">
                        {clientAssignments.length} project{clientAssignments.length !== 1 ? "s" : ""}
                      </span>
                      {clientAssignments.length > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-stone-200 dark:bg-zinc-800">
                            <div
                              className="h-full rounded-full bg-[var(--color-brand-primary)] transition-all"
                              style={{ width: `${avgProgress}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-stone-700 dark:text-zinc-300">
                            {avgProgress}%
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleToggleStar(e, client.id)}
                      className={`shrink-0 rounded-lg p-1.5 transition ${
                        client.is_starred
                          ? 'text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300'
                          : 'text-stone-300 hover:text-amber-500 dark:text-zinc-600 dark:hover:text-amber-400'
                      }`}
                      title={client.is_starred ? 'Remove from frequents' : 'Add to frequents'}
                    >
                      <Star className={`h-4 w-4 ${client.is_starred ? 'fill-current' : ''}`} />
                    </button>
                    <ChevronRight className="h-4 w-4 text-stone-300 transition group-hover:text-[var(--color-brand-primary)] dark:text-zinc-600" />
                  </Link>
                );
              })}
            </div>
          )}

        </div>

      {/* Add client modal */}
      <AddClientModal
        open={showAddModal}
        isPending={isPending}
        createError={createError}
        createSuccess={createSuccess}
        showAddress={showAddress}
        setShowAddress={setShowAddress}
        addressLine1={addressLine1}
        setAddressLine1={setAddressLine1}
        addressLine2={addressLine2}
        setAddressLine2={setAddressLine2}
        city={city}
        setCity={setCity}
        state={state}
        setState={setState}
        zipCode={zipCode}
        setZipCode={setZipCode}
        handleAddressSelect={handleAddressSelect}
        handleCreateClient={handleCreateClient}
        onClose={closeAddModal}
      />

      {/* Notify clients modal */}
      <NotifyClientsModal
        open={showNotifyModal}
        starredClients={starredClients}
        onClose={() => setShowNotifyModal(false)}
      />
    </div>
  );
}

// ── Add client modal ─────────────────────────────────────────

function AddClientModal({
  open,
  isPending,
  createError,
  createSuccess,
  showAddress,
  setShowAddress,
  addressLine1,
  setAddressLine1,
  addressLine2,
  setAddressLine2,
  city,
  setCity,
  state,
  setState,
  zipCode,
  setZipCode,
  handleAddressSelect,
  handleCreateClient,
  onClose,
}: {
  open: boolean;
  isPending: boolean;
  createError: string | null;
  createSuccess: boolean;
  showAddress: boolean;
  setShowAddress: (v: boolean | ((prev: boolean) => boolean)) => void;
  addressLine1: string;
  setAddressLine1: (v: string) => void;
  addressLine2: string;
  setAddressLine2: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  state: string;
  setState: (v: string) => void;
  zipCode: string;
  setZipCode: (v: string) => void;
  handleAddressSelect: (parts: AddressParts) => void;
  handleCreateClient: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} scrollable size="lg" panelClassName="rounded-3xl">
      {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[var(--color-brand-subtle)] p-2 text-[var(--color-brand-primary)]">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-900 dark:text-white">Add client</h2>
              <p className="text-sm text-stone-500 dark:text-zinc-500">
                Create the client record before attaching them to a project.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
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
          <label className="text-sm font-medium text-stone-700 dark:text-zinc-300">
            Notes <span className="text-stone-400 dark:text-zinc-500">(optional)</span>
            <textarea
              rows={2}
              name="notes"
              className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none ring-0 transition focus:border-[var(--color-brand-primary)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
            />
          </label>

          {/* Progressive disclosure: address section */}
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={() => setShowAddress((v: boolean) => !v)}
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
                    <label htmlFor="modal-address1" className="text-xs font-medium text-stone-600 dark:text-zinc-400">
                      Street address
                    </label>
                    <AddressAutocomplete
                      id="modal-address1"
                      value={addressLine1}
                      onChange={setAddressLine1}
                      onSelect={handleAddressSelect}
                      placeholder="Start typing an address…"
                      disabled={isPending}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label htmlFor="modal-address2" className="text-xs font-medium text-stone-600 dark:text-zinc-400">
                      Suite / unit <span className="text-stone-400 dark:text-zinc-500">(optional)</span>
                    </label>
                    <input
                      id="modal-address2"
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
                    <label htmlFor="modal-city" className="text-xs font-medium text-stone-600 dark:text-zinc-400">City</label>
                    <input
                      id="modal-city"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Springfield"
                      disabled={isPending}
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none ring-0 transition focus:border-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="modal-state" className="text-xs font-medium text-stone-600 dark:text-zinc-400">State</label>
                    <select
                      id="modal-state"
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
                    <label htmlFor="modal-zip" className="text-xs font-medium text-stone-600 dark:text-zinc-400">ZIP</label>
                    <input
                      id="modal-zip"
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

          <div className="flex items-center justify-between gap-3 md:col-span-2">
            {createError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>
            ) : createSuccess ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">Client created successfully.</p>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-primary)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" />
              Create client
            </button>
          </div>
        </form>
    </Modal>
  );
}

// ── Suggested frequents panel ────────────────────────────────

function SuggestedFrequentsPanel({
  suggestions,
  isPending,
  onAccept,
  onDismiss,
}: {
  suggestions: FrequentBuyerSuggestion[];
  isPending: boolean;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <div className="rounded-xl bg-amber-100 p-2 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-stone-900 dark:text-white">
            Suggested Frequents
          </p>
          <p className="text-xs text-stone-500 dark:text-zinc-500">
            {suggestions.length} buyer{suggestions.length !== 1 ? 's' : ''} detected from recent sales
          </p>
        </div>
        <ChevronDown className={`h-4 w-4 text-stone-400 transition ${collapsed ? '' : 'rotate-180'} dark:text-zinc-500`} />
      </button>

      {!collapsed && (
        <div className="space-y-2 px-5 pb-4">
          {suggestions.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-4 rounded-xl border border-stone-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-stone-900 dark:text-white">
                  {s.buyer_email}
                </p>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-stone-500 dark:text-zinc-500">
                  <span>{s.sale_count} purchase{s.sale_count !== 1 ? 's' : ''}</span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {Number(s.total_spent).toFixed(2)}
                  </span>
                  {s.last_purchase_at && (
                    <span>
                      Last: {new Date(s.last_purchase_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={() => onAccept(s.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-brand-primary)] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-60"
              >
                <Star className="h-3 w-3" />
                Add
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => onDismiss(s.id)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-700 disabled:opacity-60 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Notify clients modal ─────────────────────────────────────

function NotifyClientsModal({
  open,
  starredClients,
  onClose,
}: {
  open: boolean;
  starredClients: OnboardingClientProfile[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(starredClients.map((c) => c.id)),
  );
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await notifyFrequentClients({
        clientIds: [...selectedIds],
        subject,
        body,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      setTimeout(onClose, 2000);
    });
  };

  return (
    <Modal open={open} scrollable size="lg" panelClassName="rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[var(--color-brand-subtle)] p-2 text-[var(--color-brand-primary)]">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-900 dark:text-white">Notify Clients</h2>
              <p className="text-sm text-stone-500 dark:text-zinc-500">
                Send an email to your starred clients.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
            Notifications sent successfully!
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Recipients */}
            <div>
              <label className="mb-2 block text-sm font-medium text-stone-700 dark:text-zinc-300">
                Recipients ({selectedIds.size} selected)
              </label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-zinc-700 dark:bg-zinc-950">
                {starredClients.map((client) => (
                  <label
                    key={client.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-stone-100 dark:hover:bg-zinc-800"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(client.id)}
                      onChange={() => handleToggle(client.id)}
                      className="rounded border-stone-300 text-[var(--color-brand-primary)] dark:border-zinc-600"
                    />
                    <span className="text-stone-900 dark:text-white">{client.full_name}</span>
                    <span className="text-stone-400 dark:text-zinc-500">{client.email}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="block text-sm font-medium text-stone-700 dark:text-zinc-300">
              Subject
              <input
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-[var(--color-brand-primary)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              />
            </label>

            <label className="block text-sm font-medium text-stone-700 dark:text-zinc-300">
              Message
              <textarea
                required
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-[var(--color-brand-primary)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              />
            </label>

            <div className="flex items-center justify-between gap-3">
              {error ? (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              ) : (
                <span />
              )}
              <button
                type="submit"
                disabled={isPending || selectedIds.size === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-primary)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Bell className="h-4 w-4" />
                {isPending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        )}
    </Modal>
  );
}
