"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Loader2, Lock, Save, Sun, Moon } from "lucide-react";
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

      {!canManageSettings && (
        <p className="mb-3 text-xs text-stone-500 dark:text-zinc-400">
          You can view defaults, but only managers can edit them.
        </p>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        <p className="text-xs text-stone-500 dark:text-zinc-400">
          Configure appearance for{" "}
          <span className="font-medium text-stone-700 dark:text-zinc-300">{orgName}</span>.
          Enforced settings override member preferences.
        </p>

        {/* Theme + Font Size — compact 2-column */}
        <div className="rounded-xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-stone-100 px-5 py-3 dark:border-zinc-800/60">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-white">Display</h2>
            <p className="text-xs text-stone-500 dark:text-zinc-500">Theme and typography defaults</p>
          </div>
          <div className="divide-y divide-stone-100 dark:divide-zinc-800/60">
            <SettingRow
              label="Theme"
              settingKey="theme"
              enforced={enforcedKeys.has("theme")}
              onSetEnforced={setEnforced}
              editable={canManageSettings}
            >
              <div className="flex gap-1.5">
                {(["light", "dark"] as const).map((mode) => {
                  const Icon = mode === "light" ? Sun : Moon;
                  return (
                    <button
                      key={mode}
                      type="button"
                      disabled={!canManageSettings}
                      onClick={() => updateOrgField("theme", mode)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                        orgTheme === mode
                          ? "border-[var(--color-brand-primary)]/30 bg-[var(--color-brand-subtle)] text-[var(--color-brand-primary)]"
                          : "border-stone-200 text-stone-600 hover:border-stone-300 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  );
                })}
              </div>
            </SettingRow>

            <SettingRow
              label="Font size"
              settingKey="fontSize"
              enforced={enforcedKeys.has("fontSize")}
              onSetEnforced={setEnforced}
              editable={canManageSettings}
            >
              <select
                value={orgFontSize}
                disabled={!canManageSettings}
                onChange={(e) => updateOrgField("fontSize", e.target.value as FontSize)}
                className="settings-input w-auto"
              >
                {(Object.entries(FONT_SIZE_LABELS) as [FontSize, string][]).map(
                  ([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  )
                )}
              </select>
            </SettingRow>
          </div>
        </div>

        {/* Branding */}
        <div className="rounded-xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-stone-100 px-5 py-3 dark:border-zinc-800/60">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-white">Branding</h2>
            <p className="text-xs text-stone-500 dark:text-zinc-500">Custom colors and logo</p>
          </div>
          <div className="divide-y divide-stone-100 dark:divide-zinc-800/60">
            <SettingRow
              label="Primary color"
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
            </SettingRow>

            <SettingRow
              label="Accent color"
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
            </SettingRow>

            <SettingRow
              label="Logo URL"
              settingKey="logoUrl"
              enforced={enforcedKeys.has("logoUrl")}
              onSetEnforced={setEnforced}
              editable={canManageSettings}
            >
              <div className="flex items-center gap-2">
                {orgSettings.logoUrl && (
                  <Image
                    src={orgSettings.logoUrl}
                    alt="Preview"
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-md border border-stone-200 object-cover dark:border-zinc-700"
                    unoptimized
                  />
                )}
                <input
                  type="url"
                  disabled={!canManageSettings}
                  value={orgSettings.logoUrl ?? ""}
                  onChange={(e) => updateOrgField("logoUrl", e.target.value || null)}
                  placeholder="https://example.com/logo.png"
                  className="settings-input flex-1"
                />
              </div>
            </SettingRow>
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end border-t border-stone-200 pt-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !canManageSettings}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand-primary)] px-5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[var(--color-brand-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save settings
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ── Compact inline setting row ──────────────────────────────

function SettingRow({
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
    <div className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-stone-900 dark:text-white">{label}</span>
        {editable ? (
          <button
            type="button"
            onClick={() => onSetEnforced(settingKey, !enforced)}
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
              enforced
                ? "bg-[var(--color-brand-subtle)] text-[var(--color-brand-primary)]"
                : "bg-stone-100 text-stone-500 hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            <Lock className="h-2.5 w-2.5" />
            {enforced ? "Enforced" : "Optional"}
          </button>
        ) : (
          <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            enforced
              ? "bg-[var(--color-brand-subtle)] text-[var(--color-brand-primary)]"
              : "bg-stone-100 text-stone-500 dark:bg-zinc-800 dark:text-zinc-400"
          }`}>
            <Lock className="h-2.5 w-2.5" />
            {enforced ? "Enforced" : "Optional"}
          </span>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}
