"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Loader2,
  LogOut,
  Plus,
  ArrowLeft,
  Building2,
  FolderKanban,
  Crown,
  Shield,
  User,
  Trash2,
  Users,
  Settings,
  CreditCard,
  ExternalLink,
  AlertTriangle,
  Sparkles,
  Mail,
  ImageIcon,
  Pencil,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  getOrganization,
  getProjects,
  getOrgMembers,
  getPendingInvitations,
  getMyOrgRole,
  sendOrgInvitation,
  cancelInvitation,
  deleteOrganization,
  deleteProject,
  createStripeConnectAccount,
  getStripeOnboardingLink,
  getStripeAccountStatus,
  getPermissionsForOrg,
  type OrgInvitation,
  type Organization,
  type Project,
  type OrgMember,
  type MemberWithProfile,
} from "@/app/organizations/actions";
import type { Permission } from "@/lib/rbac-types";
import ConfirmDeleteModal from "@/app/components/confirm-delete-modal";
import { InviteMemberModal } from "@/app/components/invite-member-modal";
import { TierBadge } from "@/app/components/tier-badge";
import { TIERS, type SubscriptionTier } from "@/lib/tiers";

const roleBadge: Record<OrgMember["role"], { label: string; color: string; Icon: typeof Crown }> = {
  superadmin: { label: "Super Admin", color: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400", Icon: Crown },
  admin: { label: "Admin", color: "bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400", Icon: Shield },
  member: { label: "Member", color: "bg-stone-100 text-stone-600 dark:bg-zinc-800 dark:text-zinc-400", Icon: User },
};

type MemberRow = MemberWithProfile;
type PendingInvitationRow = OrgInvitation;

export default function OrganizationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orgId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<Organization | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [myRole, setMyRole] = useState<OrgMember["role"] | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [deleteOrgModalOpen, setDeleteOrgModalOpen] = useState(false);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<{ id: string; name: string } | null>(null);
  const [stripeStatus, setStripeStatus] = useState<{
    connected: boolean;
    onboardingComplete: boolean;
    accountId: string | null;
  } | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitationRow[]>([]);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteWarning, setInviteWarning] = useState("");

  const load = useCallback(
    async (uid: string) => {
      const [orgResult, projectsResult, membersResult, roleResult, stripeResult, permsResult, pendingResult] = await Promise.all([
        getOrganization(orgId),
        getProjects(orgId),
        getOrgMembers(orgId),
        getMyOrgRole(orgId, uid),
        getStripeAccountStatus(orgId),
        getPermissionsForOrg(orgId, uid),
        getPendingInvitations(orgId),
      ]);

      if (orgResult.error) {
        setError(orgResult.error);
        setLoading(false);
        return;
      }

      setOrg(orgResult.data ?? null);
      setProjects(projectsResult.data ?? []);

      const memberData = (membersResult.data ?? []) as MemberRow[];
      setMembers(memberData);
      setPendingInvitations((pendingResult.data ?? []) as PendingInvitationRow[]);

      setMyRole(roleResult.role ?? null);
      setPermissions(permsResult);

      if (stripeResult.data) {
        setStripeStatus(stripeResult.data);
      }

      setLoading(false);
    },
    [orgId]
  );

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      load(session.user.id);
      setUserId(session.user.id);
    }
    checkAuth();
  }, [router, load]);

  async function handleConnectStripe() {
    setStripeLoading(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // If no account yet, create one first
      if (!stripeStatus?.connected) {
        const createResult = await createStripeConnectAccount(orgId, session.user.id);
        if (createResult.error) {
          setError(createResult.error);
          setStripeLoading(false);
          return;
        }
      }

      // Get onboarding link
      const linkResult = await getStripeOnboardingLink(orgId, session.user.id);
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

  async function confirmDeleteOrg() {
    if (!userId) return;
    const result = await deleteOrganization(orgId, userId);
    if (result.error) {
      setError(result.error);
      setDeleteOrgModalOpen(false);
    } else {
      router.push("/organizations");
    }
  }

  async function confirmDeleteProject() {
    if (!deleteProjectTarget) return;
    const result = await deleteProject(deleteProjectTarget.id, userId ?? undefined, orgId);
    if (result.error) {
      setError(result.error);
    } else {
      setProjects((prev) => prev.filter((p) => p.id !== deleteProjectTarget.id));
    }
    setDeleteProjectTarget(null);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function handleInviteMember(email: string, role: "admin" | "member") {
    if (!userId) {
      setInviteError("User not authenticated.");
      return;
    }

    setInviteSubmitting(true);
    setInviteError("");
    setInviteWarning("");

    const result = await sendOrgInvitation(orgId, email, role, userId);
    if (result.error) {
      setInviteError(result.error);
      setInviteSubmitting(false);
      throw new Error(result.error);
    }

    if (result.warning) {
      setInviteWarning(result.warning);
    }

    const pendingResult = await getPendingInvitations(orgId);
    if (pendingResult.data) {
      setPendingInvitations(pendingResult.data as PendingInvitationRow[]);
    }

    setInviteSubmitting(false);
  }

  async function handleCancelInvitation(invitationId: string) {
    if (!userId) return;

    const result = await cancelInvitation(orgId, invitationId, userId);
    if (result.error) {
      setError(result.error);
      return;
    }

    setPendingInvitations((prev) => prev.filter((invite) => invite.id !== invitationId));
  }

  const canManage = permissions.includes('org:update');
  const canDelete = permissions.includes('org:delete');
  const canManageBilling = permissions.includes('billing:manage');
  const canManageProjects = permissions.includes('projects:create');
  const canDeleteProjects = permissions.includes('projects:delete');
  const canInviteMembers = permissions.includes('members:invite');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans selection:bg-stone-200 dark:bg-zinc-950 dark:selection:bg-zinc-800">

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back */}
        <Link
          href="/organizations"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Organizations
        </Link>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400"
          >
            {error}
          </motion.p>
        )}

        {!org ? (
          <p className="text-sm text-stone-500 dark:text-zinc-400">Organization not found.</p>
        ) : (
          <>
            {/* Org header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex items-start gap-4">
                {org.cover_image_url ? (
                  <div className="relative h-14 w-14 overflow-hidden rounded-2xl">
                    <Image
                      src={org.cover_image_url}
                      alt={org.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                    <Building2 className="h-7 w-7" />
                  </div>
                )}
                <div>
                  <h1 className="text-3xl font-bold text-stone-900 dark:text-white">
                    {org.name}
                  </h1>
                  <p className="mt-0.5 text-sm text-stone-500 dark:text-zinc-500">
                    /{org.slug}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canManage && (
                  <Link
                    href="/settings"
                    className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-all hover:border-stone-300 hover:bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setDeleteOrgModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-all hover:bg-red-50 dark:border-red-900/40 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete org
                  </button>
                )}
              </div>
            </motion.div>

            {/* Stripe Connect section */}
            {canManageBilling && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.025 }}
                className="mb-10"
              >
                <div className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                        Stripe Connect
                      </h2>
                      <p className="text-sm text-stone-500 dark:text-zinc-500">
                        Accept payments for your inventory items
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
                          Payments go directly to your Stripe account
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
                      <div className="flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3 dark:bg-amber-900/20">
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <div>
                          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                            Onboarding incomplete
                          </p>
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            Complete your Stripe setup to start accepting payments.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleConnectStripe}
                        disabled={stripeLoading}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {stripeLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ExternalLink className="h-4 w-4" />
                        )}
                        Continue setup
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-stone-600 dark:text-zinc-400">
                        Connect a Stripe account to receive payments when buyers purchase your inventory items. Payments flow directly to your bank account.
                      </p>
                      <button
                        type="button"
                        onClick={handleConnectStripe}
                        disabled={stripeLoading}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {stripeLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CreditCard className="h-4 w-4" />
                        )}
                        Connect Stripe account
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Subscription Plan section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.035 }}
              className="mb-10"
            >
              <div className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                        Subscription Plan
                      </h2>
                      <TierBadge
                        tier={(org.subscription_tier ?? "free") as SubscriptionTier}
                        size="md"
                      />
                    </div>
                    <p className="text-sm text-stone-500 dark:text-zinc-500">
                      Manage your organization&apos;s subscription
                    </p>
                  </div>
                </div>

                {(() => {
                  const currentTier = (org.subscription_tier ?? "free") as SubscriptionTier;
                  const tierData = TIERS[currentTier];
                  return (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-600 dark:text-zinc-400">
                        <span>
                          Plan:{" "}
                          <span className="font-medium text-stone-900 dark:text-white">
                            {tierData.name}
                          </span>
                        </span>
                        <span className="text-stone-300 dark:text-zinc-700">·</span>
                        <span>
                          Team members: up to{" "}
                          <span className="font-medium text-stone-900 dark:text-white">
                            {tierData.memberLimit === Infinity
                              ? "unlimited"
                              : tierData.memberLimit}
                          </span>
                        </span>
                      </div>

                      {myRole === "superadmin" && currentTier !== "enterprise" && (
                        <div className="flex flex-wrap items-center gap-3">
                          {currentTier === "free" && (
                            <Link
                              href={`/upgrade?orgId=${orgId}`}
                              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-700"
                            >
                              <Sparkles className="h-4 w-4" />
                              Upgrade to Pro
                            </Link>
                          )}
                          <Link
                            href={`/upgrade?orgId=${orgId}`}
                            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-all hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                          >
                            View all plans
                          </Link>
                        </div>
                      )}

                      {!canManageBilling && currentTier !== "enterprise" && (
                        <p className="text-sm text-stone-500 dark:text-zinc-500">
                          Contact your organization owner to upgrade.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </motion.div>

            {/* Projects section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="mb-10"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-stone-900 dark:text-white">Projects</h2>
                {canManageProjects && (
                  <Link
                    href={`/organizations/${orgId}/projects/new`}
                    className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    <Plus className="h-4 w-4" />
                    New project
                  </Link>
                )}
              </div>

              {projects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
                  <FolderKanban className="mx-auto mb-3 h-9 w-9 text-stone-400 dark:text-zinc-600" />
                  <h3 className="text-base font-bold text-stone-900 dark:text-white">
                    No projects yet
                  </h3>
                  <p className="mt-1 text-sm text-stone-600 dark:text-zinc-400">
                    Create a project to organize your inventory and sales.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {projects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/organizations/${orgId}/projects/${project.id}`}
                      className="overflow-hidden rounded-2xl border border-stone-200 bg-white transition-all hover:border-indigo-200 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-800"
                    >
                      {project.cover_image_url ? (
                        <div className="relative h-32 w-full bg-stone-100 dark:bg-zinc-800">
                          <Image
                            src={project.cover_image_url}
                            alt={project.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="flex h-32 w-full items-center justify-center bg-stone-50 dark:bg-zinc-800/50">
                          <ImageIcon className="h-10 w-10 text-stone-300 dark:text-zinc-700" />
                        </div>
                      )}
                      <div className="p-5">
                        <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
                          {project.name}
                        </h3>
                        {project.description && (
                          <p className="mt-1 text-xs text-stone-500 dark:text-zinc-500 line-clamp-2">
                            {project.description}
                          </p>
                        )}
                        <div className="mt-4 flex items-center gap-2">
                          <span
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </span>
                          {canDeleteProjects && (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteProjectTarget({ id: project.id, name: project.name }); }}
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Members section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
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
                    <Plus className="h-4 w-4" />
                    Invite member
                  </button>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                {members.map((member) => {
                  const badge = roleBadge[member.role];
                  const BadgeIcon = badge.Icon;
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5 last:border-b-0 dark:border-zinc-800/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-200 text-sm font-bold text-stone-600 dark:bg-zinc-700 dark:text-zinc-300">
                          {(member.profiles?.full_name?.[0] || member.email?.[0] || "?").toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-stone-900 dark:text-white">
                            {member.profiles?.full_name || member.email || "Unknown user"}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.color}`}
                      >
                        <BadgeIcon className="h-3 w-3" />
                        {badge.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {pendingInvitations.length > 0 && (
                <div className="mt-6">
                  <div className="mb-3 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
                      Pending invitations ({pendingInvitations.length})
                    </h3>
                  </div>

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
                </div>
              )}
            </motion.div>

            <InviteMemberModal
              isOpen={inviteModalOpen}
              onClose={() => { setInviteModalOpen(false); setInviteWarning(""); }}
              onSubmit={handleInviteMember}
              isLoading={inviteSubmitting}
              error={inviteError}
              warning={inviteWarning}
            />

            {/* Delete Organization Modal */}
            <ConfirmDeleteModal
              open={deleteOrgModalOpen}
              onClose={() => setDeleteOrgModalOpen(false)}
              onConfirm={confirmDeleteOrg}
              entityName={org.name}
              entityType="organization"
              description="All projects, inventory items, and member associations will be permanently deleted."
            />

            {/* Delete Project Modal */}
            <ConfirmDeleteModal
              open={deleteProjectTarget !== null}
              onClose={() => setDeleteProjectTarget(null)}
              onConfirm={confirmDeleteProject}
              entityName={deleteProjectTarget?.name ?? ""}
              entityType="project"
              description="All inventory items in this project will be permanently deleted."
            />
          </>
        )}
      </main>
    </div>
  );
}