"use client";

import { motion } from "framer-motion";
import { Shield, Key, Globe, Clock, Lock } from "lucide-react";

type SecuritySettingsProps = Readonly<{
  orgId: string;
  canManageSettings: boolean;
}>;

export function SecuritySettings({ orgId, canManageSettings }: SecuritySettingsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Authentication */}
      <div className="rounded-xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-stone-100 px-5 py-3 dark:border-zinc-800/60">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-white">Authentication</h2>
          <p className="text-xs text-stone-500 dark:text-zinc-500">How members sign in to your organization</p>
        </div>
        <div className="divide-y divide-stone-100 dark:divide-zinc-800/60">
          <SettingToggleRow
            icon={Shield}
            label="Require two-factor authentication"
            description="All members must enable 2FA to access this organization"
            enabled={false}
            disabled={!canManageSettings}
            enterprise
          />
          <SettingToggleRow
            icon={Key}
            label="SSO / SAML"
            description="Configure single sign-on for enterprise identity providers"
            enabled={false}
            disabled
            enterprise
          />
        </div>
      </div>

      {/* Session & Access */}
      <div className="rounded-xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-stone-100 px-5 py-3 dark:border-zinc-800/60">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-white">Session & Access</h2>
          <p className="text-xs text-stone-500 dark:text-zinc-500">Control active sessions and access policies</p>
        </div>
        <div className="divide-y divide-stone-100 dark:divide-zinc-800/60">
          <div className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-stone-400 dark:text-zinc-500" />
              <div>
                <p className="text-sm font-medium text-stone-900 dark:text-white">Session timeout</p>
                <p className="text-xs text-stone-500 dark:text-zinc-500">Auto-logout after inactivity</p>
              </div>
            </div>
            <select
              disabled={!canManageSettings}
              defaultValue="24h"
              className="settings-input w-auto"
            >
              <option value="1h">1 hour</option>
              <option value="8h">8 hours</option>
              <option value="24h">24 hours</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
            </select>
          </div>
          <SettingToggleRow
            icon={Globe}
            label="IP allowlist"
            description="Restrict access to specific IP addresses or ranges"
            enabled={false}
            disabled
            enterprise
          />
        </div>
      </div>

      {/* API Keys */}
      <div className="rounded-xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3 dark:border-zinc-800/60">
          <div>
            <h2 className="text-sm font-semibold text-stone-900 dark:text-white">API Keys</h2>
            <p className="text-xs text-stone-500 dark:text-zinc-500">Manage programmatic access tokens</p>
          </div>
          {canManageSettings && (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-500 dark:border-zinc-700 dark:text-zinc-500"
            >
              <Key className="h-3.5 w-3.5" />
              Generate key
              <EnterpriseBadge />
            </button>
          )}
        </div>
        <div className="px-5 py-6 text-center">
          <Key className="mx-auto mb-2 h-6 w-6 text-stone-300 dark:text-zinc-600" />
          <p className="text-sm text-stone-500 dark:text-zinc-400">No API keys configured</p>
          <p className="text-xs text-stone-400 dark:text-zinc-500">Create keys for integration with external services</p>
        </div>
      </div>
    </motion.div>
  );
}

// ── Toggle Row ──────────────────────────────────────────────

function SettingToggleRow({
  icon: Icon,
  label,
  description,
  enabled,
  disabled,
  enterprise,
}: Readonly<{
  icon: typeof Shield;
  label: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  enterprise?: boolean;
}>) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-stone-400 dark:text-zinc-500" />
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-stone-900 dark:text-white">{label}</p>
            {enterprise && <EnterpriseBadge />}
          </div>
          <p className="text-xs text-stone-500 dark:text-zinc-500">{description}</p>
        </div>
      </div>
      <button
        type="button"
        disabled={disabled}
        role="switch"
        aria-checked={enabled}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          enabled ? "bg-indigo-600" : "bg-stone-200 dark:bg-zinc-700"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
            enabled ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function EnterpriseBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
      <Lock className="h-2 w-2" />
      Pro
    </span>
  );
}
