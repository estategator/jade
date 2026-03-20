"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Loader2,
  Lock,
  Save,
  Sun,
  Moon,
  Monitor,
  Building2,
  Users,
  Mail,
  CreditCard,
  ExternalLink,
  Sparkles,
  Shield,
  Crown,
  User,
  AlertTriangle,
  Upload,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/app/components/page-header";
import { useSettings } from "@/app/components/settings-provider";
import {
  getOrgSettings,
  updateOrgSettings,
  getUserOrgSettings,
  updateUserOrgSettings,
} from "@/app/settings/actions";
import {
  getOrganization,
  getPermissionsForOrg,
  getOrgMembers,
  getPendingInvitations,
  sendOrgInvitation,
  cancelInvitation,
  updateMemberRole,
  updateMemberStatus,
  updateOrganization,
  createStripeConnectAccount,
  getStripeOnboardingLink,
  getStripeAccountStatus,
  createBillingPortalSession,
  type OrgMember,
  type OrgInvitation,
  type Organization,
  type SubscriptionStatus,
} from "@/app/organizations/actions";
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
import { InviteMemberModal } from "@/app/components/invite-member-modal";
import { TierBadge } from "@/app/components/tier-badge";
import { TIERS, type SubscriptionTier } from "@/lib/tiers";

type Tab = "general" | "personal" | "appearance" | "team" | "billing";
type MemberRow = OrgMember & {
  email: string | null;
  profiles: { full_name: string; avatar_url: string | null } | null;
};
type PendingInvitationRow = OrgInvitation;

export default function SettingsPage() {
  const router = useRouter();
  const {
    settings: effectiveSettings,
    lockedKeys,
    activeOrgId,
    updateSetting,
    refresh,
  } = useSettings();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [orgName, setOrgName] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("general");

  // General org settings state
  const [editOrgName, setEditOrgName] = useState("");
  const [orgImageFile, setOrgImageFile] = useState<File | null>(null);
  const [orgImagePreview, setOrgImagePreview] = useState<string | null>(null);
  const [orgDragging, setOrgDragging] = useState(false);
  const [generalSaving, setGeneralSaving] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [generalSuccess, setGeneralSuccess] = useState("");
  const orgFileInputRef = useRef<HTMLInputElement>(null);

  // Permission flags
  const [canManageSettings, setCanManageSettings] = useState(false);
  const [canInviteMembers, setCanInviteMembers] = useState(false);
  const [canManageBilling, setCanManageBilling] = useState(false);
  const [canUpdateMembers, setCanUpdateMembers] = useState(false);

  // Personal settings state
  const [localSettings, setLocalSettings] = useState<Partial<AppSettings>>({});

  // Organization appearance state
  const [orgSettings, setOrgSettings] = useState<Partial<AppSettings>>({});
  const [enforcedKeys, setEnforcedKeys] = useState<Set<string>>(new Set());
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgError, setOrgError] = useState("");
  const [orgSuccess, setOrgSuccess] = useState("");

  // Team state
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitationRow[]>([]);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteWarning, setInviteWarning] = useState("");
  const [memberUpdating, setMemberUpdating] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<Record<string, string>>({});

  // Billing state
  const [org, setOrg] = useState<Organization | null>(null);
  const [stripeStatus, setStripeStatus] = useState<{
    connected: boolean;
    onboardingComplete: boolean;
    accountId: string | null;
  } | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      if (activeOrgId) {
        const [settingsResult, orgResult, orgSettingsResult, permsResult, membersResult, pendingResult, stripeResult] =
          await Promise.all([
            getUserOrgSettings(session.user.id, activeOrgId),
            getOrganization(activeOrgId),
            getOrgSettings(activeOrgId),
            getPermissionsForOrg(activeOrgId, session.user.id),
            getOrgMembers(activeOrgId),
            getPendingInvitations(activeOrgId),
            getStripeAccountStatus(activeOrgId),
          ]);

        if (settingsResult.data) {
          setLocalSettings(settingsResult.data.settings);
        } else {
          setLocalSettings({});
        }

        setOrg(orgResult.data ?? null);
        setOrgName(orgResult.data?.name ?? null);
        setEditOrgName(orgResult.data?.name ?? "");
        setOrgImagePreview(orgResult.data?.cover_image_url ?? null);
        setOrgImageFile(null);

        setCanManageSettings(permsResult.includes("settings:manage"));
        setCanInviteMembers(permsResult.includes("members:invite"));
        setCanManageBilling(permsResult.includes("billing:manage"));
        setCanUpdateMembers(permsResult.includes("members:update_role"));

        if (orgSettingsResult.data) {
          setOrgSettings(orgSettingsResult.data.settings);
          setEnforcedKeys(new Set(orgSettingsResult.data.enforced_keys));
        } else {
          setOrgSettings({});
          setEnforcedKeys(new Set());
        }

        setMembers((membersResult.data ?? []) as MemberRow[]);
        setPendingInvitations((pendingResult.data ?? []) as PendingInvitationRow[]);

        if (stripeResult.data) {
          setStripeStatus(stripeResult.data);
        } else {
          setStripeStatus(null);
        }
      } else {
        setOrg(null);
        setOrgName(null);
        setCanManageSettings(false);
        setCanInviteMembers(false);
        setCanManageBilling(false);
        setCanUpdateMembers(false);
        setLocalSettings({});
        setOrgSettings({});
        setEnforcedKeys(new Set());
        setMembers([]);
        setPendingInvitations([]);
        setStripeStatus(null);
      }
      setLoading(false);
    }
    init();
  }, [router, activeOrgId]);

  // ── Personal settings handlers ───────────────────────────

  function handleFieldChange<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) {
    if (lockedKeys.has(key)) return;
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    updateSetting(key, value);
  }

  async function handleSave() {
    setError("");
    setSuccess("");

    if (!activeOrgId) {
      setError("Select an organization to save settings.");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError("Not authenticated.");
      return;
    }

    setSaving(true);
    const result = await updateUserOrgSettings(
      session.user.id,
      activeOrgId,
      localSettings
    );

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess("Settings saved.");
      refresh();
    }
    setSaving(false);
  }

  // ── Organization appearance handlers ─────────────────────

  function updateOrgField<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) {
    setOrgSettings((prev) => ({ ...prev, [key]: value }));
  }

  function setEnforced(key: string, enforced: boolean) {
    setEnforcedKeys((prev) => {
      const next = new Set(prev);
      if (enforced) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  async function handleOrgSave() {
    setOrgError("");
    setOrgSuccess("");

    if (!canManageSettings) {
      setOrgError("You do not have permission to update organization settings.");
      return;
    }

    setOrgSaving(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setOrgError("Not authenticated.");
      setOrgSaving(false);
      return;
    }

    const result = await updateOrgSettings(
      activeOrgId!,
      session.user.id,
      orgSettings,
      Array.from(enforcedKeys)
    );

    if (result.error) {
      setOrgError(result.error);
    } else {
      setOrgSuccess("Organization settings saved.");
      refresh();
    }
    setOrgSaving(false);
  }

  // ── Team and invitation handlers ─────────────────────────

  async function handleInviteMember(email: string, role: "admin" | "member") {
    if (!activeOrgId) {
      setInviteError("Select an organization first.");
      throw new Error("Select an organization first.");
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setInviteError("Not authenticated.");
      throw new Error("Not authenticated.");
    }

    setInviteSubmitting(true);
    setInviteError("");
    setInviteWarning("");

    const result = await sendOrgInvitation(activeOrgId, email, role, session.user.id);
    if (result.error) {
      setInviteError(result.error);
      setInviteSubmitting(false);
      throw new Error(result.error);
    }

    if (result.warning) {
      setInviteWarning(result.warning);
    }

    const pendingResult = await getPendingInvitations(activeOrgId);
    if (pendingResult.data) {
      setPendingInvitations(pendingResult.data as PendingInvitationRow[]);
    }

    setInviteSubmitting(false);
  }

  async function handleCancelInvitation(invitationId: string) {
    if (!activeOrgId) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setError("Not authenticated.");
      return;
    }

    const result = await cancelInvitation(activeOrgId, invitationId, session.user.id);
    if (result.error) {
      setError(result.error);
      return;
    }

    setPendingInvitations((prev) => prev.filter((invite) => invite.id !== invitationId));
  }

  async function handleRoleChange(memberId: string, newRole: OrgMember["role"]) {
    if (!activeOrgId) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setMemberUpdating(memberId);
    setMemberError((prev) => { const next = { ...prev }; delete next[memberId]; return next; });

    const result = await updateMemberRole(activeOrgId, memberId, newRole, session.user.id);
    if (result.error) {
      setMemberError((prev) => ({ ...prev, [memberId]: result.error! }));
    } else {
      setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role: newRole } : m));
    }
    setMemberUpdating(null);
  }

  async function handleStatusChange(memberId: string, newStatus: "active" | "suspended") {
    if (!activeOrgId) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setMemberUpdating(memberId);
    setMemberError((prev) => { const next = { ...prev }; delete next[memberId]; return next; });

    const result = await updateMemberStatus(activeOrgId, memberId, newStatus, session.user.id);
    if (result.error) {
      setMemberError((prev) => ({ ...prev, [memberId]: result.error! }));
    } else {
      setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, status: newStatus } : m));
    }
    setMemberUpdating(null);
  }

  // ── Billing handlers ──────────────────────────────────────

  async function handleConnectStripe() {
    if (!activeOrgId) return;

    setStripeLoading(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Not authenticated.");
        setStripeLoading(false);
        return;
      }

      if (!stripeStatus?.connected) {
        const createResult = await createStripeConnectAccount(activeOrgId, session.user.id);
        if (createResult.error) {
          setError(createResult.error);
          setStripeLoading(false);
          return;
        }
      }

      const linkResult = await getStripeOnboardingLink(activeOrgId, session.user.id);
      if (linkResult.error) {
        setError(linkResult.error);
        setStripeLoading(false);
        return;
      }

      if (linkResult.url) {
        window.location.href = linkResult.url;
      }
    } catch {
      setError("Failed to start Stripe onboarding.");
      setStripeLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const theme = effectiveSettings.theme;
  const fontSize = effectiveSettings.fontSize;
  const orgTheme =
    (orgSettings.theme as ThemeMode) ?? DEFAULT_SETTINGS.theme;
  const orgFontSize =
    (orgSettings.fontSize as FontSize) ?? DEFAULT_SETTINGS.fontSize;

  const tabs: { key: Tab; label: string; visible: boolean }[] = [
    { key: "general", label: "General", visible: !!activeOrgId },
    { key: "personal", label: "My Preferences", visible: true },
    { key: "appearance", label: "Organization Appearance", visible: !!activeOrgId },
    { key: "team", label: "Team & Invitations", visible: !!activeOrgId },
    { key: "billing", label: "Billing & Stripe", visible: !!activeOrgId },
  ];
  const visibleTabs = tabs.filter((t) => t.visible);

  return (
    <>
      <PageHeader
        title="Settings"
        description={
          activeOrgId && orgName
            ? `Preferences for ${orgName}`
            : "Select an organization to customize preferences."
        }
      />

        {!activeOrgId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900"
          >
            <Building2 className="mx-auto mb-3 h-8 w-8 text-stone-400 dark:text-zinc-600" />
            <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
              No organization selected
            </h3>
            <p className="mt-1 text-xs text-stone-500 dark:text-zinc-500">
              Use the organization switcher in the navbar to select an org, then
              customize your settings for it.
            </p>
          </motion.div>
        )}

        {/* Tabs */}
        {activeOrgId && visibleTabs.length > 1 && (
          <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-stone-200 bg-stone-100 p-1 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-5">
            {visibleTabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => { setTab(t.key); setError(""); setSuccess(""); setOrgError(""); setOrgSuccess(""); setGeneralError(""); setGeneralSuccess(""); }}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  tab === t.key
                    ? "bg-white text-stone-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                    : "text-stone-500 hover:text-stone-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* ═══ General Tab ═══ */}
        {activeOrgId && tab === "general" && (
          <>
            {generalError && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400"
              >
                {generalError}
              </motion.p>
            )}

            {generalSuccess && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-400"
              >
                {generalSuccess}
              </motion.p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="mt-8 space-y-8"
            >
              <div className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-stone-900 dark:text-white">Organization Details</h2>
                    <p className="text-sm text-stone-500 dark:text-zinc-500">Update your organization name and image</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Org name */}
                  <div>
                    <label htmlFor="org-name" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
                      Organization name
                    </label>
                    <input
                      id="org-name"
                      type="text"
                      value={editOrgName}
                      onChange={(e) => setEditOrgName(e.target.value)}
                      className="block w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500"
                      disabled={!canManageSettings}
                    />
                  </div>

                  {/* Cover image */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
                      Cover image
                    </label>
                    <input
                      ref={orgFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (!file.type.startsWith("image/")) { setGeneralError("Please upload an image file."); return; }
                          if (file.size > 10 * 1024 * 1024) { setGeneralError("Image must be under 10 MB."); return; }
                          setGeneralError("");
                          setOrgImageFile(file);
                          setOrgImagePreview(URL.createObjectURL(file));
                        }
                      }}
                      className="hidden"
                      disabled={!canManageSettings}
                    />
                    {orgImagePreview ? (
                      <div className="relative overflow-hidden rounded-xl border border-stone-200 dark:border-zinc-700">
                        <Image
                          src={orgImagePreview}
                          alt="Organization cover"
                          width={600}
                          height={300}
                          className="w-full max-h-56 object-cover"
                          unoptimized
                        />
                        {canManageSettings && (
                          <div className="absolute right-2 top-2">
                            <button
                              type="button"
                              onClick={() => {
                                setOrgImageFile(null);
                                setOrgImagePreview(null);
                                if (orgFileInputRef.current) orgFileInputRef.current.value = "";
                              }}
                              className="rounded-lg bg-stone-900/70 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-stone-900"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        onClick={() => canManageSettings && orgFileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); if (canManageSettings) setOrgDragging(true); }}
                        onDragLeave={() => setOrgDragging(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setOrgDragging(false);
                          if (!canManageSettings) return;
                          const file = e.dataTransfer.files?.[0];
                          if (file) {
                            if (!file.type.startsWith("image/")) { setGeneralError("Please upload an image file."); return; }
                            if (file.size > 10 * 1024 * 1024) { setGeneralError("Image must be under 10 MB."); return; }
                            setGeneralError("");
                            setOrgImageFile(file);
                            setOrgImagePreview(URL.createObjectURL(file));
                          }
                        }}
                        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 transition-all ${
                          orgDragging
                            ? "border-indigo-400 bg-indigo-50/50 dark:border-indigo-600 dark:bg-indigo-900/10"
                            : "border-stone-300 bg-white hover:border-indigo-300 hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-indigo-800 dark:hover:bg-zinc-800/50"
                        }`}
                      >
                        <Upload className="h-6 w-6 text-stone-400 dark:text-zinc-500" />
                        <p className="text-sm font-medium text-stone-900 dark:text-white">Click or drag an image</p>
                        <p className="text-xs text-stone-500 dark:text-zinc-500">JPG, PNG, or WebP up to 10 MB</p>
                      </div>
                    )}
                  </div>

                  {/* Save */}
                  {canManageSettings && (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={generalSaving}
                        onClick={async () => {
                          setGeneralError("");
                          setGeneralSuccess("");
                          if (!editOrgName.trim()) { setGeneralError("Organization name is required."); return; }
                          setGeneralSaving(true);
                          const formData = new FormData();
                          formData.append("name", editOrgName);
                          if (orgImageFile) formData.append("image", orgImageFile);
                          const result = await updateOrganization(activeOrgId!, formData);
                          if (result.error) {
                            setGeneralError(result.error);
                          } else {
                            setGeneralSuccess(result.warning || "Organization updated.");
                            setOrgName(editOrgName.trim());
                            setOrgImageFile(null);
                            // Refresh org data to get the latest cover_image_url
                            const orgResult = await getOrganization(activeOrgId!);
                            if (orgResult.data) {
                              setOrg(orgResult.data);
                              setOrgImagePreview(orgResult.data.cover_image_url ?? null);
                            }
                          }
                          setGeneralSaving(false);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-transparent bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {generalSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save changes
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}

        {/* ═══ My Preferences Tab ═══ */}
        {activeOrgId && tab === "personal" && (
          <>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400"
              >
                {error}
              </motion.p>
            )}

            {success && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-400"
              >
                {success}
              </motion.p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="mt-8 space-y-8"
            >
              {/* Theme */}
              <UserSettingCard label="Theme" locked={lockedKeys.has("theme")}>
                <div className="flex gap-2">
                  {(["light", "dark", "system"] as const).map((mode) => {
                    const Icon =
                      mode === "light"
                        ? Sun
                        : mode === "dark"
                          ? Moon
                          : Monitor;
                    return (
                      <button
                        key={mode}
                        type="button"
                        disabled={lockedKeys.has("theme")}
                        onClick={() => handleFieldChange("theme", mode)}
                        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                          theme === mode
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
              </UserSettingCard>

              {/* Font Size */}
              <UserSettingCard
                label="Font Size"
                locked={lockedKeys.has("fontSize")}
              >
                <select
                  value={fontSize}
                  disabled={lockedKeys.has("fontSize")}
                  onChange={(e) =>
                    handleFieldChange("fontSize", e.target.value as FontSize)
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
              </UserSettingCard>

              {/* Brand Primary */}
              <UserSettingCard
                label="Brand Primary Color"
                locked={lockedKeys.has("brandPrimary")}
              >
                <ColorPalette
                  presets={BRAND_PRIMARY_PRESETS}
                  value={effectiveSettings.brandPrimary}
                  defaultColor="#6366f1"
                  disabled={lockedKeys.has("brandPrimary")}
                  onChange={(c) => handleFieldChange("brandPrimary", c)}
                />
              </UserSettingCard>

              {/* Brand Accent */}
              <UserSettingCard
                label="Brand Accent Color"
                locked={lockedKeys.has("brandAccent")}
              >
                <ColorPalette
                  presets={BRAND_ACCENT_PRESETS}
                  value={effectiveSettings.brandAccent}
                  defaultColor="#10b981"
                  disabled={lockedKeys.has("brandAccent")}
                  onChange={(c) => handleFieldChange("brandAccent", c)}
                />
              </UserSettingCard>

              {/* Save */}
              <div className="flex justify-end border-t border-stone-200 pt-6 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-[var(--color-brand-primary)] px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-[var(--color-brand-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save settings
                </button>
              </div>
            </motion.div>
          </>
        )}

        {/* ═══ Organization Appearance Tab ═══ */}
        {activeOrgId && tab === "appearance" && (
          <>
            {orgError && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400"
              >
                {orgError}
              </motion.p>
            )}

            {orgSuccess && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-400"
              >
                {orgSuccess}
              </motion.p>
            )}

            <p className="mt-6 text-sm text-stone-500 dark:text-zinc-400">
              Configure appearance defaults for{" "}
              <span className="font-medium text-stone-700 dark:text-zinc-300">
                {orgName}
              </span>
              . Enforced settings override member preferences.
            </p>

            {!canManageSettings && (
              <p className="mt-3 text-sm text-stone-500 dark:text-zinc-400">
                You can view organization defaults, but only managers can edit them.
              </p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="mt-6 space-y-8"
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
                      mode === "light"
                        ? Sun
                        : mode === "dark"
                          ? Moon
                          : Monitor;
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
                  onClick={handleOrgSave}
                  disabled={orgSaving || !canManageSettings}
                  className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-[var(--color-brand-primary)] px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-[var(--color-brand-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {orgSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save organization settings
                </button>
              </div>
            </motion.div>
          </>
        )}

        {/* ═══ Team & Invitations Tab ═══ */}
        {activeOrgId && tab === "team" && (
          <>
            <p className="mt-6 text-sm text-stone-500 dark:text-zinc-400">
              Manage organization members and pending invitations.
            </p>

            {!canInviteMembers && !canUpdateMembers && (
              <p className="mt-3 text-sm text-stone-500 dark:text-zinc-400">
                You can view membership, but only managers can modify roles or send invitations.
              </p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="mt-6 space-y-6"
            >
              <div>
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-stone-400 dark:text-zinc-500" />
                    <h2 className="text-lg font-bold text-stone-900 dark:text-white">Members</h2>
                    <span className="text-sm text-stone-500 dark:text-zinc-500">({members.length})</span>
                  </div>
                  {canInviteMembers && (
                    <button
                      type="button"
                      onClick={() => {
                        setInviteError("");
                        setInviteModalOpen(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-700"
                    >
                      <Mail className="h-4 w-4" />
                      Invite member
                    </button>
                  )}
                </div>

                <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                  {members.map((member) => {
                    const isUpdating = memberUpdating === member.id;
                    const rowError = memberError[member.id];
                    const RoleIcon = member.role === "superadmin" ? Crown : member.role === "admin" ? Shield : User;

                    return (
                      <div
                        key={member.id}
                        className="border-b border-stone-100 px-5 py-3.5 last:border-b-0 dark:border-zinc-800/50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                              member.status === "suspended"
                                ? "bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-stone-200 text-stone-600 dark:bg-zinc-700 dark:text-zinc-300"
                            }`}>
                              {(member.profiles?.full_name?.[0] || member.email?.[0] || "?").toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-stone-900 dark:text-white">
                                {member.profiles?.full_name || member.email || "Unknown user"}
                              </p>
                              {member.status === "suspended" && (
                                <p className="text-xs text-red-500 dark:text-red-400">Suspended</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isUpdating && <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />}

                            {canUpdateMembers ? (
                              <>
                                <select
                                  value={member.role}
                                  disabled={isUpdating}
                                  onChange={(e) => handleRoleChange(member.id, e.target.value as OrgMember["role"])}
                                  className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                                >
                                  <option value="superadmin">Super Admin</option>
                                  <option value="admin">Admin</option>
                                  <option value="member">Member</option>
                                </select>

                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => handleStatusChange(member.id, member.status === "active" ? "suspended" : "active")}
                                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                    member.status === "active"
                                      ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                                      : "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                                  }`}
                                >
                                  {member.status === "active" ? (
                                    <>
                                      <AlertTriangle className="h-3 w-3" />
                                      Suspend
                                    </>
                                  ) : (
                                    <>
                                      <Shield className="h-3 w-3" />
                                      Activate
                                    </>
                                  )}
                                </button>
                              </>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600 dark:bg-zinc-800 dark:text-zinc-300">
                                <RoleIcon className="h-3 w-3" />
                                {member.role === "superadmin"
                                  ? "Super Admin"
                                  : member.role === "admin"
                                    ? "Admin"
                                    : "Member"}
                              </span>
                            )}
                          </div>
                        </div>

                        {rowError && (
                          <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{rowError}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
                    Pending invitations ({pendingInvitations.length})
                  </h3>
                </div>

                {pendingInvitations.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                    No pending invitations.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-950/20">
                    {pendingInvitations.map((invitation) => (
                      <div
                        key={invitation.id}
                        className="flex items-center justify-between border-b border-amber-100 px-5 py-3.5 last:border-b-0 dark:border-amber-900/30"
                      >
                        <div>
                          <p className="text-sm font-medium text-stone-900 dark:text-white">{invitation.email}</p>
                          <p className="text-xs text-stone-600 dark:text-zinc-400">
                            Invited {new Date(invitation.created_at).toLocaleDateString()} as {invitation.requested_role === "admin" ? "Admin" : "Member"}
                          </p>
                        </div>

                        {canInviteMembers && (
                          <button
                            type="button"
                            onClick={() => handleCancelInvitation(invitation.id)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>

            <InviteMemberModal
              isOpen={inviteModalOpen}
              onClose={() => { setInviteModalOpen(false); setInviteWarning(""); }}
              onSubmit={handleInviteMember}
              isLoading={inviteSubmitting}
              error={inviteError}
              warning={inviteWarning}
            />
          </>
        )}

        {/* ═══ Billing & Stripe Tab ═══ */}
        {activeOrgId && tab === "billing" && (
          <>
            <p className="mt-6 text-sm text-stone-500 dark:text-zinc-400">
              Manage Stripe onboarding and your organization subscription.
            </p>

            {!canManageBilling && (
              <p className="mt-3 text-sm text-stone-500 dark:text-zinc-400">
                You can view billing status, but only billing managers can make changes.
              </p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="mt-6 space-y-6"
            >
              <div className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-stone-900 dark:text-white">Subscription Plan</h2>
                      <TierBadge
                        tier={((org?.subscription_tier ?? "free") as SubscriptionTier)}
                        size="md"
                      />
                    </div>
                    <p className="text-sm text-stone-500 dark:text-zinc-500">
                      Current billing tier and member limits
                    </p>
                  </div>
                </div>

                {(() => {
                  const currentTier = (org?.subscription_tier ?? "free") as SubscriptionTier;
                  const tierData = TIERS[currentTier];
                  const subStatus = (org?.subscription_status ?? "none") as SubscriptionStatus;
                  const cancelPending = org?.cancel_at_period_end ?? false;

                  return (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-600 dark:text-zinc-400">
                        <span>
                          Plan: <span className="font-medium text-stone-900 dark:text-white">{tierData.name}</span>
                        </span>
                        <span className="text-stone-300 dark:text-zinc-700">·</span>
                        <span>
                          Team members: up to <span className="font-medium text-stone-900 dark:text-white">{tierData.memberLimit === Infinity ? "unlimited" : tierData.memberLimit}</span>
                        </span>
                        {subStatus !== "none" && (
                          <>
                            <span className="text-stone-300 dark:text-zinc-700">·</span>
                            <span>
                              Status:{" "}
                              <span className={`font-medium ${
                                subStatus === "active" ? "text-emerald-600 dark:text-emerald-400"
                                  : subStatus === "past_due" ? "text-red-600 dark:text-red-400"
                                  : "text-stone-900 dark:text-white"
                              }`}>
                                {subStatus.replace("_", " ")}
                              </span>
                            </span>
                          </>
                        )}
                      </div>

                      {cancelPending && (
                        <p className="text-sm text-red-600 dark:text-red-400">
                          Your subscription will cancel at the end of the current billing period.
                        </p>
                      )}

                      {subStatus === "past_due" && (
                        <p className="text-sm text-red-600 dark:text-red-400">
                          Your last payment failed. Please update your payment method to keep your plan active.
                        </p>
                      )}

                      {canManageBilling && (
                        <div className="flex flex-wrap gap-3">
                          {currentTier === "free" && (
                            <Link
                              href={activeOrgId ? `/upgrade?orgId=${activeOrgId}` : "/upgrade"}
                              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-700"
                            >
                              <Sparkles className="h-4 w-4" />
                              Upgrade to Pro
                            </Link>
                          )}
                          {org?.stripe_customer_id && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (!activeOrgId) return;
                                const { data: { session } } = await supabase.auth.getSession();
                                if (!session) return;
                                const result = await createBillingPortalSession(activeOrgId, session.user.id);
                                if (result.url) window.location.href = result.url;
                                if (result.error) setError(result.error);
                              }}
                              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-all hover:border-stone-300 hover:bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                            >
                              <CreditCard className="h-4 w-4" />
                              Billing portal
                            </button>
                          )}
                        </div>
                      )}

                      {!canManageBilling && (
                        <p className="text-sm text-stone-500 dark:text-zinc-500">
                          Contact an organization billing manager to change plans.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-stone-900 dark:text-white">Stripe Connect</h2>
                    <p className="text-sm text-stone-500 dark:text-zinc-500">
                      Connect payouts for organization sales
                    </p>
                  </div>
                </div>

                {stripeStatus?.onboardingComplete ? (
                  <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-900/20">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                      <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        Stripe account connected
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        Payouts are enabled for this organization.
                      </p>
                    </div>
                    <a
                      href="https://dashboard.stripe.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 transition-colors hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                    >
                      Dashboard
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ) : stripeStatus?.connected ? (
                  <div className="space-y-3">
                    <p className="text-sm text-stone-600 dark:text-zinc-400">
                      Stripe account exists, but onboarding is incomplete.
                    </p>
                    {canManageBilling && (
                      <button
                        type="button"
                        onClick={handleConnectStripe}
                        disabled={stripeLoading}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {stripeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                        Continue setup
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-stone-600 dark:text-zinc-400">
                      Connect Stripe to receive payouts when inventory sells.
                    </p>
                    {canManageBilling && (
                      <button
                        type="button"
                        onClick={handleConnectStripe}
                        disabled={stripeLoading}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {stripeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                        Connect Stripe account
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
    </>
  );
}

// ── Sub-component ────────────────────────────────────────────

function UserSettingCard({
  label,
  locked,
  children,
}: Readonly<{
  label: string;
  locked: boolean;
  children: React.ReactNode;
}>) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-stone-900 dark:text-white">{label}</h3>
        {locked && (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
            <Lock className="h-2.5 w-2.5" />
            Set by organization
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

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
