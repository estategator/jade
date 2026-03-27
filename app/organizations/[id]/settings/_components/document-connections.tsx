"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  FileSignature,
  ExternalLink,
  Unlink,
  Star,
  Check,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import ConfirmDeleteModal from "@/app/components/confirm-delete-modal";
import {
  connectDocumentProvider,
  disconnectDocumentProvider,
  setDefaultDocumentProvider,
} from "@/app/organizations/document-provider-actions";
import type {
  DocumentProvider,
  DocumentProviderConnectionStatus,
} from "@/lib/document-providers/types";
import {
  DOCUMENT_PROVIDER_DISPLAY,
  ALL_DOCUMENT_PROVIDERS,
} from "@/lib/document-providers/types";

// ── Icon map ─────────────────────────────────────────────────

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  FileSignature,
};

// ── Types ────────────────────────────────────────────────────

type DocumentConnectionsProps = Readonly<{
  orgId: string;
  canManageConnections: boolean;
  initialStatuses: DocumentProviderConnectionStatus[];
}>;

// ── Component ────────────────────────────────────────────────

export function DocumentConnections({
  orgId,
  canManageConnections,
  initialStatuses,
}: DocumentConnectionsProps) {
  const [statuses, setStatuses] = useState<DocumentProviderConnectionStatus[]>(initialStatuses);
  const [loadingProvider, setLoadingProvider] = useState<DocumentProvider | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<DocumentProvider | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function getStatus(provider: DocumentProvider) {
    return statuses.find((s) => s.provider === provider) ?? {
      provider,
      connected: false,
      externalAccountId: null,
      isDefault: false,
    };
  }

  async function handleConnect(provider: DocumentProvider) {
    setLoadingProvider(provider);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Not authenticated."); return; }

      const result = await connectDocumentProvider(orgId, session.user.id, provider);
      if (result.url) {
        window.location.href = result.url;
      } else if (result.error) {
        setError(result.error);
      }
    } catch {
      setError(`Failed to start ${DOCUMENT_PROVIDER_DISPLAY[provider].name} connection.`);
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

      const result = await disconnectDocumentProvider(orgId, session.user.id, provider);
      if (result.success) {
        setStatuses((prev) =>
          prev.map((s) =>
            s.provider === provider
              ? { ...s, connected: false, externalAccountId: null, isDefault: false }
              : s,
          ),
        );
        setSuccess(`${DOCUMENT_PROVIDER_DISPLAY[provider].name} disconnected.`);
        setDisconnectTarget(null);
      } else {
        setError(result.error || "Failed to disconnect.");
      }
    } catch {
      setError("Failed to disconnect account.");
    }
  }

  async function handleSetDefault(provider: DocumentProvider) {
    setLoadingProvider(provider);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Not authenticated."); return; }

      const result = await setDefaultDocumentProvider(orgId, session.user.id, provider);
      if (result.success) {
        setStatuses((prev) =>
          prev.map((s) => ({ ...s, isDefault: s.provider === provider })),
        );
        setSuccess(`${DOCUMENT_PROVIDER_DISPLAY[provider].name} set as default document provider.`);
      } else {
        setError(result.error || "Failed to set default.");
      }
    } catch {
      setError("Failed to set default provider.");
    } finally {
      setLoadingProvider(null);
    }
  }

  const disconnectInfo = disconnectTarget ? DOCUMENT_PROVIDER_DISPLAY[disconnectTarget] : null;

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
          const connectedCount = statuses.filter((s) => s.connected).length;
          const defaultProvider = statuses.find((s) => s.isDefault && s.connected);
          return (
            <div className="flex items-center justify-between rounded-lg border border-stone-100 bg-stone-50/50 px-4 py-2.5 dark:border-zinc-800/60 dark:bg-zinc-800/30">
              <div className="flex items-center gap-3 text-xs text-stone-500 dark:text-zinc-400">
                <span>
                  {connectedCount === 0
                    ? "No document services connected"
                    : `${connectedCount} document service${connectedCount > 1 ? "s" : ""} connected`}
                </span>
                {defaultProvider && (
                  <>
                    <span className="text-stone-300 dark:text-zinc-600">|</span>
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-indigo-500 dark:text-indigo-400" />
                      {DOCUMENT_PROVIDER_DISPLAY[defaultProvider.provider].name} is default
                    </span>
                  </>
                )}
              </div>
              {connectedCount > 0 && (
                <FileSignature className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
              )}
            </div>
          );
        })()}

        {ALL_DOCUMENT_PROVIDERS.map((provider) => {
          const info = DOCUMENT_PROVIDER_DISPLAY[provider];
          const st = getStatus(provider);
          const Icon = ICONS[info.icon] ?? FileSignature;
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
                {st.connected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                    <Check className="h-3 w-3" /> Connected
                  </span>
                )}
              </div>

              {/* Body */}
              <div className="px-5 py-4">
                {st.connected ? (
                  /* ── Connected ───────────────────────────── */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2.5 dark:bg-emerald-900/20">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <div>
                          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                            Documents & signatures enabled
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
                ) : (
                  /* ── Not connected ───────────────────────── */
                  <div className="space-y-2">
                    <p className="text-sm text-stone-600 dark:text-zinc-400">
                      Connect {info.name} to send and receive documents and signatures.
                    </p>
                    {canManageConnections ? (
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
                    ) : (
                      <p className="text-xs text-stone-400 dark:text-zinc-500">
                        Ask a superadmin to configure {info.name}.
                      </p>
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
        entityType={disconnectInfo ? `${disconnectInfo.name} Connection` : "Document Connection"}
        description={
          disconnectInfo
            ? `This will disconnect your ${disconnectInfo.name} account. You will no longer be able to send documents or collect signatures through ${disconnectInfo.name}. You can reconnect later.`
            : ""
        }
      />
    </>
  );
}
