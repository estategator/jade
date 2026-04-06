"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Globe,
  ExternalLink,
  Unlink,
  Star,
  Check,
  Eye,
  EyeOff,
  ShoppingBag,
  Store,
  Gavel,
  ShoppingCart,
  RefreshCw,
  Clock,
  Lock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import ConfirmDeleteModal from "@/app/components/confirm-delete-modal";
import {
  connectListingProvider,
  disconnectListingProvider,
  setDefaultListingProvider,
  getListingOAuthUrl,
} from "@/app/organizations/listing-provider-actions";
import type {
  ListingProvider,
  ListingProviderConnectionStatus,
} from "@/lib/listing-providers/types";
import {
  LISTING_PROVIDER_DISPLAY,
  ALL_LISTING_PROVIDERS,
} from "@/lib/listing-providers/types";

// ── Icon map ─────────────────────────────────────────────────

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Globe,
  ShoppingBag,
  Store,
  Gavel,
  ShoppingCart,
};

/** Providers that are live and connectable. Others show as "Coming Soon". */
const ENABLED_PROVIDERS = new Set<ListingProvider>([
  "estatesales_net",
  "ebay",
]);

// ── Types ────────────────────────────────────────────────────

type ListingConnectionsProps = Readonly<{
  orgId: string;
  canManageConnections: boolean;
  initialStatuses: ListingProviderConnectionStatus[];
}>;

// ── Component ────────────────────────────────────────────────

export function ListingConnections({
  orgId,
  canManageConnections,
  initialStatuses,
}: ListingConnectionsProps) {
  const [statuses, setStatuses] =
    useState<ListingProviderConnectionStatus[]>(initialStatuses);
  const [loadingProvider, setLoadingProvider] =
    useState<ListingProvider | null>(null);
  const [disconnectTarget, setDisconnectTarget] =
    useState<ListingProvider | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [connectingProvider, setConnectingProvider] =
    useState<ListingProvider | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  function getStatus(provider: ListingProvider) {
    return (
      statuses.find((s) => s.provider === provider) ?? {
        provider,
        connected: false,
        externalAccountId: null,
        isDefault: false,
        username: null,
        syncStatus: null,
        lastSyncAt: null,
      }
    );
  }

  async function handleOAuthConnect(provider: ListingProvider) {
    setLoadingProvider(provider);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Not authenticated.");
        return;
      }

      const result = await getListingOAuthUrl(orgId, session.user.id, provider);
      if (result.url) {
        window.location.href = result.url;
      } else {
        setError(result.error || "Failed to start OAuth flow.");
      }
    } catch {
      setError(`Failed to connect ${LISTING_PROVIDER_DISPLAY[provider].name}.`);
    } finally {
      setLoadingProvider(null);
    }
  }

  async function handleConnect(provider: ListingProvider) {
    setLoadingProvider(provider);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Not authenticated.");
        return;
      }

      const result = await connectListingProvider(
        orgId,
        session.user.id,
        provider,
        formValues
      );
      if (result.success) {
        const info = LISTING_PROVIDER_DISPLAY[provider];
        setSuccess(`${info.name} connected successfully.`);
        setStatuses((prev) =>
          prev.map((s) =>
            s.provider === provider
              ? {
                  ...s,
                  connected: true,
                  externalAccountId:
                    formValues.organization_id?.replace("#", "").trim() ?? null,
                  isDefault: prev.every(
                    (p) => !p.connected || p.provider === provider
                  ),
                  username: formValues.username ?? null,
                }
              : s
          )
        );
        setConnectingProvider(null);
        setFormValues({});
      } else if (result.error) {
        setError(result.error);
      }
    } catch {
      setError(`Failed to connect ${LISTING_PROVIDER_DISPLAY[provider].name}.`);
    } finally {
      setLoadingProvider(null);
    }
  }

  async function handleDisconnect() {
    if (!disconnectTarget) return;
    const provider = disconnectTarget;
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Not authenticated.");
        return;
      }

      const result = await disconnectListingProvider(
        orgId,
        session.user.id,
        provider
      );
      if (result.success) {
        setStatuses((prev) =>
          prev.map((s) =>
            s.provider === provider
              ? {
                  ...s,
                  connected: false,
                  externalAccountId: null,
                  isDefault: false,
                  username: null,
                }
              : s
          )
        );
        setSuccess(`${LISTING_PROVIDER_DISPLAY[provider].name} disconnected.`);
        setDisconnectTarget(null);
      } else {
        setError(result.error || "Failed to disconnect.");
      }
    } catch {
      setError("Failed to disconnect account.");
    }
  }

  async function handleSetDefault(provider: ListingProvider) {
    setLoadingProvider(provider);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Not authenticated.");
        return;
      }

      const result = await setDefaultListingProvider(
        orgId,
        session.user.id,
        provider
      );
      if (result.success) {
        setStatuses((prev) =>
          prev.map((s) => ({ ...s, isDefault: s.provider === provider }))
        );
        setSuccess(
          `${LISTING_PROVIDER_DISPLAY[provider].name} set as default listing provider.`
        );
      } else {
        setError(result.error || "Failed to set default.");
      }
    } catch {
      setError("Failed to set default provider.");
    } finally {
      setLoadingProvider(null);
    }
  }

  const disconnectInfo = disconnectTarget
    ? LISTING_PROVIDER_DISPLAY[disconnectTarget]
    : null;

  // Split providers into enabled and coming-soon groups
  const enabledProviders = ALL_LISTING_PROVIDERS.filter((p) =>
    ENABLED_PROVIDERS.has(p)
  );
  const comingSoonProviders = ALL_LISTING_PROVIDERS.filter(
    (p) => !ENABLED_PROVIDERS.has(p)
  );

  return (
    <>
      {!canManageConnections && (
        <p className="mb-3 text-xs text-stone-500 dark:text-zinc-400">
          You can view connection status, but only superadmins can make changes.
        </p>
      )}

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {success && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-400"
          >
            {success}
          </motion.p>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* ── Summary bar ──────────────────────────────────── */}
        {(() => {
          const connectedCount = statuses.filter((s) => s.connected).length;
          const defaultProvider = statuses.find(
            (s) => s.isDefault && s.connected
          );
          return (
            <div className="flex items-center justify-between rounded-lg border border-stone-100 bg-stone-50/50 px-4 py-2.5 dark:border-zinc-800/60 dark:bg-zinc-800/30">
              <div className="flex items-center gap-3 text-xs text-stone-500 dark:text-zinc-400">
                <span>
                  {connectedCount === 0
                    ? "No listing sites connected"
                    : `${connectedCount} listing site${connectedCount > 1 ? "s" : ""} connected`}
                </span>
                {defaultProvider && (
                  <>
                    <span className="text-stone-300 dark:text-zinc-600">|</span>
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-indigo-500 dark:text-indigo-400" />
                      {LISTING_PROVIDER_DISPLAY[defaultProvider.provider].name}{" "}
                      is default
                    </span>
                  </>
                )}
              </div>
              {connectedCount > 0 && (
                <Globe className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
              )}
            </div>
          );
        })()}

        {/* ── Active provider cards ────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2">
          {enabledProviders.map((provider, i) => {
            const info = LISTING_PROVIDER_DISPLAY[provider];
            const st = getStatus(provider);
            const Icon = ICONS[info.icon] ?? Globe;
            const isLoading = loadingProvider === provider;
            const isConnecting = connectingProvider === provider;

            return (
              <motion.div
                key={provider}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.06 }}
                className="group relative flex flex-col rounded-2xl border border-stone-200 bg-white transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:shadow-zinc-800/40"
              >
                {/* Card header */}
                <div className="flex items-start gap-3 px-5 pt-5 pb-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      st.connected
                        ? "bg-emerald-50 dark:bg-emerald-900/20"
                        : "bg-stone-100 dark:bg-zinc-800"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 ${
                        st.connected
                          ? "text-emerald-600 dark:text-emerald-400"
                          : `${info.brandColor} ${info.darkBrandColor}`
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
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
                    <p className="mt-0.5 text-xs leading-relaxed text-stone-500 dark:text-zinc-500">
                      {info.description}
                    </p>
                  </div>
                </div>

                {/* Card body */}
                <div className="flex flex-1 flex-col px-5 pb-5">
                  {st.connected ? (
                    /* ── Connected state ─────────────────── */
                    <div className="flex flex-1 flex-col gap-3">
                      <div className="rounded-lg bg-emerald-50 px-3 py-2.5 dark:bg-emerald-900/20">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                            <Check className="h-3 w-3" /> Connected
                          </span>
                          <div className="flex items-center gap-2">
                            {st.lastSyncAt && (
                              <span className="flex items-center gap-1 text-[10px] text-stone-400 dark:text-zinc-500">
                                <Clock className="h-2.5 w-2.5" />
                                {new Date(st.lastSyncAt).toLocaleDateString()}
                              </span>
                            )}
                            {st.syncStatus === "syncing" && (
                              <RefreshCw className="h-3 w-3 animate-spin text-indigo-500" />
                            )}
                          </div>
                        </div>
                        <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                          {st.username ? `${st.username} · ` : ""}
                          {info.oauthSupported
                            ? "OAuth connected"
                            : `Org #${st.externalAccountId ?? "linked"}`}
                        </p>
                      </div>

                      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                        {info.dashboardUrl && (
                          <a
                            href={info.dashboardUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                          >
                            Dashboard{" "}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {canManageConnections && (
                          <>
                            {!st.isDefault && (
                              <button
                                type="button"
                                onClick={() => handleSetDefault(provider)}
                                disabled={isLoading}
                                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isLoading ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Star className="h-3 w-3" />
                                )}
                                Set Default
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDisconnectTarget(provider)}
                              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-500 transition-all hover:border-red-300 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-500 dark:hover:border-red-800 dark:hover:text-red-400"
                            >
                              <Unlink className="h-3 w-3" />
                              Disconnect
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : isConnecting ? (
                    /* ── Connection form ─────────────────── */
                    <div className="space-y-3">
                      <p className="text-xs text-stone-500 dark:text-zinc-400">
                        Enter your {info.name} credentials to connect.
                      </p>
                      {info.connectionFields.map((field) => (
                        <div key={field.key}>
                          <label
                            htmlFor={`${provider}-${field.key}`}
                            className="mb-1 block text-xs font-medium text-stone-700 dark:text-zinc-300"
                          >
                            {field.label}
                          </label>
                          <div className="relative">
                            <input
                              id={`${provider}-${field.key}`}
                              type={
                                field.type === "password" &&
                                !showPassword[field.key]
                                  ? "password"
                                  : "text"
                              }
                              value={formValues[field.key] ?? ""}
                              onChange={(e) =>
                                setFormValues((prev) => ({
                                  ...prev,
                                  [field.key]: e.target.value,
                                }))
                              }
                              placeholder={field.placeholder}
                              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                            />
                            {field.type === "password" && (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowPassword((prev) => ({
                                    ...prev,
                                    [field.key]: !prev[field.key],
                                  }))
                                }
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                              >
                                {showPassword[field.key] ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                            )}
                          </div>
                          {field.helpText && (
                            <p className="mt-1 text-[11px] text-stone-400 dark:text-zinc-500">
                              {field.helpText}
                              {field.helpUrl && (
                                <>
                                  {" "}
                                  <a
                                    href={field.helpUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                                  >
                                    Open page{" "}
                                    <ExternalLink className="inline h-2.5 w-2.5" />
                                  </a>
                                </>
                              )}
                            </p>
                          )}
                        </div>
                      ))}
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleConnect(provider)}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Validate & Connect
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConnectingProvider(null);
                            setFormValues({});
                            setError("");
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-500 transition-all hover:text-stone-700 dark:border-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Not connected ───────────────────── */
                    <div className="flex flex-1 flex-col gap-3">
                      <p className="text-sm leading-relaxed text-stone-600 dark:text-zinc-400">
                        Connect {info.name} to publish your sales and reach more
                        buyers.
                        {info.capabilities.canSyncOrders &&
                          " Orders will sync automatically."}
                      </p>
                      {canManageConnections && (
                        <div className="mt-auto pt-1">
                          {info.oauthSupported ? (
                            <button
                              type="button"
                              onClick={() => handleOAuthConnect(provider)}
                              disabled={isLoading}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isLoading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Icon className="h-3.5 w-3.5" />
                              )}
                              Connect with {info.name}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setConnectingProvider(provider);
                                setError("");
                                setSuccess("");
                              }}
                              disabled={isLoading}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Icon className="h-3.5 w-3.5" />
                              Connect {info.name}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── Coming Soon cards ─────────────────────────────── */}
        {comingSoonProviders.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-medium uppercase tracking-wider text-stone-400 dark:text-zinc-500">
              Coming Soon
            </h4>
            <div className="grid gap-4 sm:grid-cols-3">
              {comingSoonProviders.map((provider, i) => {
                const info = LISTING_PROVIDER_DISPLAY[provider];
                const Icon = ICONS[info.icon] ?? Globe;

                return (
                  <motion.div
                    key={provider}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.15 + i * 0.05 }}
                    className="relative flex flex-col items-center rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 px-5 py-6 text-center dark:border-zinc-700/60 dark:bg-zinc-800/30"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 dark:bg-zinc-800">
                      <Icon className="h-5 w-5 text-stone-400 dark:text-zinc-500" />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-stone-700 dark:text-zinc-300">
                      {info.name}
                    </h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-stone-400 dark:text-zinc-500">
                      {info.description}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-stone-200/60 px-2.5 py-1 text-[10px] font-medium text-stone-500 dark:bg-zinc-700/50 dark:text-zinc-400">
                      <Lock className="h-2.5 w-2.5" />
                      Coming Soon
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>

      <ConfirmDeleteModal
        open={!!disconnectTarget}
        onClose={() => setDisconnectTarget(null)}
        onConfirm={handleDisconnect}
        entityName="disconnect"
        entityType={
          disconnectInfo
            ? `${disconnectInfo.name} Connection`
            : "Listing Connection"
        }
        description={
          disconnectInfo
            ? `This will disconnect your ${disconnectInfo.name} account. You will no longer be able to publish sales to ${disconnectInfo.name}. You can reconnect later.`
            : ""
        }
      />
    </>
  );
}
