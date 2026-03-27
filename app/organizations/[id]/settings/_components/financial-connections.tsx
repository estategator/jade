"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Loader2,
  CreditCard,
  ExternalLink,
  Unlink,
  Star,
  SquareStack,
  Store,
  Check,
  AlertCircle,
  Shield,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import ConfirmDeleteModal from "@/app/components/confirm-delete-modal";
import {
  connectProvider,
  disconnectProvider,
  setDefaultProvider,
  getOnboardingUrl,
  syncProviderStatus,
} from "@/app/organizations/provider-actions";
import type {
  PaymentProvider,
  ProviderConnectionStatus,
} from "@/lib/payment-providers/types";
import { PROVIDER_DISPLAY } from "@/lib/payment-providers/types";

// ── Icon map ─────────────────────────────────────────────────

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CreditCard,
  SquareStack,
  Store,
  Shield,
};

// ── Types ────────────────────────────────────────────────────

type FinancialConnectionsProps = Readonly<{
  orgId: string;
  canManageConnections: boolean;
  initialStatuses: ProviderConnectionStatus[];
}>;

// ── Component ────────────────────────────────────────────────────

export function FinancialConnections({
  orgId,
  canManageConnections,
  initialStatuses,
}: FinancialConnectionsProps) {
  const searchParams = useSearchParams();
  const [statuses, setStatuses] = useState<ProviderConnectionStatus[]>(initialStatuses);
  const [loadingProvider, setLoadingProvider] = useState<PaymentProvider | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<PaymentProvider | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Handle OAuth callback return — show toast and refresh provider status
  useEffect(() => {
    const connectedProvider = searchParams.get("providerConnected") as PaymentProvider | null;
    const errorProvider = searchParams.get("providerError") as PaymentProvider | null;

    if (connectedProvider) {
      const name = PROVIDER_DISPLAY[connectedProvider]?.name ?? connectedProvider;
      setSuccess(`${name} connected successfully.`);

      // Refresh this provider's status from the server
      syncProviderStatus(orgId, connectedProvider).then((result) => {
        if (result.data) {
          setStatuses((prev) =>
            prev.map((s) => (s.provider === connectedProvider ? result.data! : s)),
          );
        }
      });

      // Clean the URL
      const url = new URL(window.location.href);
      url.searchParams.delete("providerConnected");
      window.history.replaceState({}, "", url.toString());
    }

    if (errorProvider) {
      const name = PROVIDER_DISPLAY[errorProvider]?.name ?? errorProvider;
      setError(`Failed to connect ${name}. Please try again.`);

      const url = new URL(window.location.href);
      url.searchParams.delete("providerError");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams, orgId]);

  function getStatus(provider: PaymentProvider) {
    return statuses.find((s) => s.provider === provider) ?? {
      provider,
      connected: false,
      onboardingComplete: false,
      externalAccountId: null,
      isDefault: false,
      requirements: null,
    };
  }

  function updateStatus(provider: PaymentProvider, patch: Partial<ProviderConnectionStatus>) {
    setStatuses((prev) =>
      prev.map((s) => (s.provider === provider ? { ...s, ...patch } : s)),
    );
  }

  async function handleConnect(provider: PaymentProvider) {
    setLoadingProvider(provider);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Not authenticated."); return; }

      const result = await connectProvider(orgId, session.user.id, provider);
      if (result.url) {
        window.location.href = result.url;
      } else if (result.error) {
        setError(result.error);
      }
    } catch {
      setError(`Failed to start ${PROVIDER_DISPLAY[provider].name} connection.`);
    } finally {
      setLoadingProvider(null);
    }
  }

  async function handleCompleteSetup(provider: PaymentProvider) {
    setLoadingProvider(provider);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Not authenticated."); return; }

      const result = await getOnboardingUrl(orgId, session.user.id, provider);
      if (result.url) {
        window.location.href = result.url;
      } else if (result.error) {
        setError(result.error);
      }
    } catch {
      setError("Failed to restart onboarding.");
    } finally {
      setLoadingProvider(null);
    }
  }

  async function handleDisconnect() {
    if (!disconnectTarget) return;
    const provider = disconnectTarget;
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Not authenticated."); return; }

      const result = await disconnectProvider(orgId, session.user.id, provider);
      if (result.success) {
        updateStatus(provider, {
          connected: false,
          onboardingComplete: false,
          externalAccountId: null,
          isDefault: false,
          requirements: null,
        });
        setSuccess(`${PROVIDER_DISPLAY[provider].name} disconnected.`);
        setDisconnectTarget(null);
      } else {
        setError(result.error || "Failed to disconnect.");
      }
    } catch {
      setError("Failed to disconnect account.");
    }
  }

  async function handleSetDefault(provider: PaymentProvider) {
    setLoadingProvider(provider);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Not authenticated."); return; }

      const result = await setDefaultProvider(orgId, session.user.id, provider);
      if (result.success) {
        setStatuses((prev) =>
          prev.map((s) => ({ ...s, isDefault: s.provider === provider })),
        );
        setSuccess(`${PROVIDER_DISPLAY[provider].name} set as default payment provider.`);
      } else {
        setError(result.error || "Failed to set default.");
      }
    } catch {
      setError("Failed to set default provider.");
    } finally {
      setLoadingProvider(null);
    }
  }

  const disconnectInfo = disconnectTarget ? PROVIDER_DISPLAY[disconnectTarget] : null;

  return (
    <>
      {!canManageConnections && (
        <p className="mb-3 text-xs text-stone-500 dark:text-zinc-400">
          You can view connection status, but only superadmins can make changes.
        </p>
      )}

      {error && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400"
        >
          {error}
        </motion.p>
      )}

      {success && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-400"
        >
          {success}
        </motion.p>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-3"
      >
        {/* Summary bar */}
        {(() => {
          const connectedCount = statuses.filter((s) => s.onboardingComplete).length;
          const defaultProvider = statuses.find((s) => s.isDefault && s.onboardingComplete);
          return (
            <div className="flex items-center justify-between rounded-lg border border-stone-100 bg-stone-50/50 px-4 py-2.5 dark:border-zinc-800/60 dark:bg-zinc-800/30">
              <div className="flex items-center gap-3 text-xs text-stone-500 dark:text-zinc-400">
                <span>
                  {connectedCount === 0
                    ? "No providers connected"
                    : `${connectedCount} provider${connectedCount > 1 ? "s" : ""} connected`}
                </span>
                {defaultProvider && (
                  <>
                    <span className="text-stone-300 dark:text-zinc-600">|</span>
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-indigo-500 dark:text-indigo-400" />
                      {PROVIDER_DISPLAY[defaultProvider.provider].name} is default
                    </span>
                  </>
                )}
              </div>
              {connectedCount > 0 && (
                <Shield className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
              )}
            </div>
          );
        })()}

        {(["stripe", "square", "clover"] as PaymentProvider[]).map((provider) => {
          const info = PROVIDER_DISPLAY[provider];
          const st = getStatus(provider);
          const Icon = ICONS[info.icon] ?? CreditCard;
          const isLoading = loadingProvider === provider;

          return (
            <div
              key={provider}
              className="rounded-xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3 dark:border-zinc-800/60">
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${info.brandColor} ${info.darkBrandColor}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
                        {info.name}
                      </h3>
                      {st.isDefault && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                          <Star className="h-2.5 w-2.5" /> Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 dark:text-zinc-500">{info.description}</p>
                  </div>
                </div>

                {/* Status badge */}
                {st.onboardingComplete && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                    <Check className="h-3 w-3" /> Connected
                  </span>
                )}
                {st.connected && !st.onboardingComplete && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600 dark:bg-zinc-800 dark:text-zinc-400">
                    <AlertCircle className="h-3 w-3" /> Incomplete
                  </span>
                )}
              </div>

              {/* Body */}
              <div className="px-5 py-4">
                {st.onboardingComplete ? (
                  /* ── Connected & Complete ────────────────── */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2.5 dark:bg-emerald-900/20">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <div>
                          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                            Payouts enabled
                          </p>
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                            Account {st.externalAccountId ? `…${st.externalAccountId.slice(-6)}` : "linked"}
                          </p>
                        </div>
                      </div>
                      {info.dashboardUrl && (
                        <a
                          href={info.dashboardUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                        >
                          Dashboard <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    {canManageConnections && (
                      <div className="flex flex-wrap gap-2">
                        {!st.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleSetDefault(provider)}
                            disabled={isLoading}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Star className="h-3.5 w-3.5" />
                            )}
                            Set as Default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDisconnectTarget(provider)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-500 transition-all hover:border-red-300 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-500 dark:hover:border-red-800 dark:hover:text-red-400"
                        >
                          <Unlink className="h-3.5 w-3.5" />
                          Disconnect
                        </button>
                      </div>
                    )}
                  </div>
                ) : st.connected ? (
                  /* ── Connected but incomplete ────────────── */
                  <div className="space-y-3">
                    <div className="rounded-lg bg-stone-50 px-3 py-2.5 dark:bg-zinc-800/60">
                      <p className="text-sm font-medium text-stone-700 dark:text-zinc-300">
                        Onboarding incomplete
                      </p>
                      <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
                        {info.name} needs more information before you can accept payouts.
                      </p>
                      {st.requirements && st.requirements.currentlyDue.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[11px] font-medium text-stone-500 dark:text-zinc-500">
                            Still needed:
                          </p>
                          <ul className="mt-1 list-inside list-disc text-[11px] text-stone-500 dark:text-zinc-400">
                            {st.requirements.currentlyDue.slice(0, 5).map((req) => (
                              <li key={req}>{req.replace(/_/g, " ")}</li>
                            ))}
                            {st.requirements.currentlyDue.length > 5 && (
                              <li>and {st.requirements.currentlyDue.length - 5} more…</li>
                            )}
                          </ul>
                        </div>
                      )}
                      {st.requirements?.errors && st.requirements.errors.length > 0 && (
                        <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                          {st.requirements.errors.join(", ")}
                        </p>
                      )}
                    </div>
                    {canManageConnections && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleCompleteSetup(provider)}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ExternalLink className="h-3.5 w-3.5" />
                          )}
                          Complete {info.name} Setup
                        </button>
                        <button
                          type="button"
                          onClick={() => setDisconnectTarget(provider)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-500 transition-all hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-500 dark:hover:border-red-800 dark:hover:text-red-400"
                        >
                          <Unlink className="h-3.5 w-3.5" />
                          Disconnect
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── Not connected ───────────────────────── */
                  <div className="space-y-2">
                    <p className="text-sm text-stone-600 dark:text-zinc-400">
                      Connect {info.name} to receive payouts when inventory sells.
                    </p>
                    {canManageConnections && (
                      <button
                        type="button"
                        onClick={() => handleConnect(provider)}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Icon className="h-3.5 w-3.5" />
                        )}
                        Connect {info.name}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </motion.div>

      <ConfirmDeleteModal
        open={!!disconnectTarget}
        onClose={() => setDisconnectTarget(null)}
        onConfirm={handleDisconnect}
        entityName="disconnect"
        entityType={disconnectInfo ? `${disconnectInfo.name} Connection` : "Provider Connection"}
        description={
          disconnectInfo
            ? `This will disconnect your ${disconnectInfo.name} account and you will no longer be able to receive payouts through ${disconnectInfo.name}. You can reconnect later, but any pending payouts may be affected.`
            : ""
        }
      />
    </>
  );
}
