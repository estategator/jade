"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Loader2, Lock, Save, Sun, Moon, Monitor } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSettings } from "@/app/components/settings-provider";
import { updateOrgSettings } from "@/app/settings/actions";
import {
  DEFAULT_SETTINGS,
  FONT_SIZE_LABELS,
  BRAND_PRIMARY_PRESETS,
  BRAND_ACCENT_PRESETS,
  type AppSettings,
  type ThemeMode,
  type FontSize,
} from "@/lib/settings";
import { ColorPalette } from "@/app/components/color-palette";

type AppearanceFormProps = Readonly<{
  orgId: string;
  orgName: string;
  canManageSettings: boolean;
  initialSettings: Partial<AppSettings>;
  initialEnforcedKeys: string[];
}>;

export function AppearanceForm({
  orgId,
  orgName,
  canManageSettings,
  initialSettings,
  initialEnforcedKeys,
}: AppearanceFormProps) {
  const { refresh } = useSettings();

  const [orgSettings, setOrgSettingsState] =
    useState<Partial<AppSettings>>(initialSettings);
  const [enforcedKeys, setEnforcedKeys] = useState<Set<string>>(
    new Set(initialEnforcedKeys)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function updateOrgField<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) {
    setOrgSettingsState((prev) => ({ ...prev, [key]: value }));
  }

  function setEnforced(key: string, enforced: boolean) {
    setEnforcedKeys((prev) => {
      const next = new Set(prev);
      if (enforced) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function handleSave() {
    setError("");
    setSuccess("");

    if (!canManageSettings) {
      setError("You do not have permission to update organization settings.");
      return;
    }

    setSaving(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError("Not authenticated.");
      setSaving(false);
      return;
    }

    const result = await updateOrgSettings(
      orgId,
      session.user.id,
      orgSettings,
      Array.from(enforcedKeys)
    );

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess("Organization settings saved.");
      refresh();
    }
    setSaving(false);
  }

  const orgTheme =
    (orgSettings.theme as ThemeMode) ?? DEFAULT_SETTINGS.theme;
  const orgFontSize =
    (orgSettings.fontSize as FontSize) ?? DEFAULT_SETTINGS.fontSize;

  return (
    <>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400"
        >
          {error}
        </motion.p>
      )}

      {success && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-400"
        >
          {success}
        </motion.p>
      )}

      <p className="mb-4 text-sm text-stone-500 dark:text-zinc-400">
        Configure appearance defaults for{" "}
        <span className="font-medium text-stone-700 dark:text-zinc-300">
          {orgName}
        </span>
        . Enforced settings override member preferences.
      </p>

      {!canManageSettings && (
        <p className="mb-4 text-sm text-stone-500 dark:text-zinc-400">
          You can view organization defaults, but only managers can edit them.
        </p>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="space-y-8"
      >
        {/* Theme */}
        <OrgSettingCard
          label="Theme"
          settingKey="theme"
          enforced={enforcedKeys.has("theme")}
          onSetEnforced={setEnforced}
          editable={canManageSettings}
        >
          <div className="flex gap-2">
            {(["light", "dark", "system"] as const).map((mode) => {
              const Icon =
                mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={!canManageSettings}
                  onClick={() => updateOrgField("theme", mode)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                    orgTheme === mode
                      ? "border-[var(--color-brand-primary)] bg-[rgb(224_242_254_/_0.1)] text-[var(--color-brand-primary)] dark:border-[var(--color-brand-primary)] dark:bg-[rgb(79_70_229_/_0.2)] dark:text-[var(--color-brand-primary)]"
                      : "border-stone-200 bg-white text-stone-700 hover:border-stone-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              );
            })}
          </div>
        </OrgSettingCard>

        {/* Font Size */}
        <OrgSettingCard
          label="Font Size"
          settingKey="fontSize"
          enforced={enforcedKeys.has("fontSize")}
          onSetEnforced={setEnforced}
          editable={canManageSettings}
        >
          <select
            value={orgFontSize}
            disabled={!canManageSettings}
            onChange={(e) =>
              updateOrgField("fontSize", e.target.value as FontSize)
            }
            className="rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
          >
            {(
              Object.entries(FONT_SIZE_LABELS) as [FontSize, string][]
            ).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </OrgSettingCard>

        {/* Brand Primary */}
        <OrgSettingCard
          label="Brand Primary Color"
          settingKey="brandPrimary"
          enforced={enforcedKeys.has("brandPrimary")}
          onSetEnforced={setEnforced}
          editable={canManageSettings}
        >
          <ColorPalette
            presets={BRAND_PRIMARY_PRESETS}
            value={orgSettings.brandPrimary ?? null}
            defaultColor="#6366f1"
            disabled={!canManageSettings}
            onChange={(c) => updateOrgField("brandPrimary", c)}
          />
        </OrgSettingCard>

        {/* Brand Accent */}
        <OrgSettingCard
          label="Brand Accent Color"
          settingKey="brandAccent"
          enforced={enforcedKeys.has("brandAccent")}
          onSetEnforced={setEnforced}
          editable={canManageSettings}
        >
          <ColorPalette
            presets={BRAND_ACCENT_PRESETS}
            value={orgSettings.brandAccent ?? null}
            defaultColor="#10b981"
            disabled={!canManageSettings}
            onChange={(c) => updateOrgField("brandAccent", c)}
          />
        </OrgSettingCard>

        {/* Logo URL */}
        <OrgSettingCard
          label="Organization Logo URL"
          settingKey="logoUrl"
          enforced={enforcedKeys.has("logoUrl")}
          onSetEnforced={setEnforced}
          editable={canManageSettings}
        >
          <div className="flex items-center gap-3">
            {orgSettings.logoUrl && (
              <Image
                src={orgSettings.logoUrl}
                alt="Preview"
                width={40}
                height={40}
                className="h-10 w-10 rounded-lg border border-stone-200 object-cover dark:border-zinc-700"
                unoptimized
              />
            )}
            <input
              type="url"
              disabled={!canManageSettings}
              value={orgSettings.logoUrl ?? ""}
              onChange={(e) =>
                updateOrgField("logoUrl", e.target.value || null)
              }
              placeholder="https://example.com/logo.png"
              className="flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            />
          </div>
        </OrgSettingCard>

        {/* Save */}
        <div className="flex justify-end border-t border-stone-200 pt-6 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !canManageSettings}
            className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-[var(--color-brand-primary)] px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-[var(--color-brand-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save organization settings
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ── Sub-component ────────────────────────────────────────────

function OrgSettingCard({
  label,
  settingKey,
  enforced,
  onSetEnforced,
  editable,
  children,
}: Readonly<{
  label: string;
  settingKey: string;
  enforced: boolean;
  onSetEnforced: (key: string, enforced: boolean) => void;
  editable: boolean;
  children: React.ReactNode;
}>) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
          {label}
        </h3>
        {editable ? (
          <div className="flex gap-1 rounded-xl border border-stone-200 bg-stone-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => onSetEnforced(settingKey, false)}
              aria-label={`${label}: Optional`}
              aria-pressed={!enforced}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${
                !enforced
                  ? "bg-white text-stone-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                  : "text-stone-500 hover:text-stone-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              }`}
            >
              Optional
            </button>
            <button
              type="button"
              onClick={() => onSetEnforced(settingKey, true)}
              aria-label={`${label}: Enforced`}
              aria-pressed={enforced}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${
                enforced
                  ? "bg-white text-stone-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                  : "text-stone-500 hover:text-stone-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              }`}
            >
              <Lock className="mr-1.5 inline h-3.5 w-3.5" />
              Enforced
            </button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600 dark:bg-zinc-800 dark:text-zinc-300">
            <Lock className="h-3 w-3" />
            {enforced ? "Enforced" : "Optional"}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
