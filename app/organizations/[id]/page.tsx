"use client";

import { useState, useEffect, useCallback, startTransition } from "react";
import { ViewTransition, addTransitionType } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Loader2,
  Plus,
  ArrowLeft,
  Building2,
  FolderKanban,
  Trash2,
  Users,
  Settings,
  CreditCard,
  Sparkles,
  ImageIcon,
  Pencil,
  Eye,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  getOrganization,
  getProjects,
  getOrgMembers,
  getStripeAccountStatus,
  deleteOrganization,
  deleteProject,
  getPermissionsForOrg,
  type Organization,
  type Project,
  type MemberWithProfile,
} from "@/app/organizations/actions";
import type { Permission } from "@/lib/rbac-types";
import ConfirmDeleteModal from "@/app/components/confirm-delete-modal";
import { DirectionalTransition } from "@/app/components/directional-transition";
import { TierBadge } from "@/app/components/tier-badge";
import { TIERS, type SubscriptionTier } from "@/lib/tiers";

type MemberRow = MemberWithProfile;

export default function OrganizationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orgId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<Organization | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
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

  const load = useCallback(
    async (uid: string) => {
      const [orgResult, projectsResult, membersResult, stripeResult, permsResult] = await Promise.all([
        getOrganization(orgId),
        getProjects(orgId),
        getOrgMembers(orgId),
        getStripeAccountStatus(orgId),
        getPermissionsForOrg(orgId, uid),
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

  async function confirmDeleteOrg() {
    if (!userId) return;
    const result = await deleteOrganization(orgId, userId);
    if (result.error) {
      setError(result.error);
      setDeleteOrgModalOpen(false);
    } else {
      startTransition(() => {
        addTransitionType('nav-back');
        router.push("/organizations");
      });
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

  const canManage = permissions.includes('org:update');
  const canDelete = permissions.includes('org:delete');
  const canManageProjects = permissions.includes('projects:create');
  const canDeleteProjects = permissions.includes('projects:delete');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <DirectionalTransition>
    <div className="min-h-screen bg-stone-50 font-sans selection:bg-stone-200 dark:bg-zinc-950 dark:selection:bg-zinc-800">

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back */}
        <Link
          href="/organizations"
          transitionTypes={['nav-back']}
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
                    <ViewTransition name={`org-avatar-${orgId}`} share="morph">
                      <Image
                        src={org.cover_image_url}
                        alt={org.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </ViewTransition>
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
                    href={`/organizations/${orgId}/settings`}
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

            {/* Billing & Stripe summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.025 }}
              className="mb-10 grid gap-4 sm:grid-cols-2"
            >
              <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-stone-900 dark:text-white">
                        Subscription
                      </h2>
                      <TierBadge
                        tier={(org.subscription_tier ?? "free") as SubscriptionTier}
                        size="md"
                      />
                    </div>
                    <p className="text-xs text-stone-500 dark:text-zinc-500">
                      {TIERS[(org.subscription_tier ?? "free") as SubscriptionTier].name} plan
                    </p>
                  </div>
                </div>
                <Link
                  href={`/organizations/${orgId}/settings/billing`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Manage billing
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-sm font-bold text-stone-900 dark:text-white">
                      Stripe Connect
                    </h2>
                    <p className="text-xs text-stone-500 dark:text-zinc-500">
                      {stripeStatus?.onboardingComplete
                        ? "Connected"
                        : stripeStatus?.connected
                          ? "Onboarding incomplete"
                          : "Not connected"}
                    </p>
                  </div>
                  {stripeStatus?.onboardingComplete && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                      <CreditCard className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  )}
                </div>
                <Link
                  href={`/organizations/${orgId}/settings/connections/financials`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Manage Stripe
                  <ChevronRight className="h-4 w-4" />
                </Link>
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
                    <div
                      key={project.id}
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
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
                            {project.name}
                          </h3>
                          {project.published ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                              Published
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-500 dark:bg-zinc-800 dark:text-zinc-400">
                              Draft
                            </span>
                          )}
                        </div>
                        {project.description && (
                          <p className="mt-1 text-xs text-stone-500 dark:text-zinc-500 line-clamp-2">
                            {project.description}
                          </p>
                        )}
                        <div className="mt-4 flex items-center gap-2">
                          <Link
                            href={`/sales/${project.id}`}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Link>
                          <Link
                            href={`/organizations/${orgId}/projects/${project.id}`}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Link>
                          {canDeleteProjects && (
                            <button
                              type="button"
                              onClick={() => setDeleteProjectTarget({ id: project.id, name: project.name })}
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Team summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mb-10"
            >
              <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-600 dark:bg-zinc-800 dark:text-zinc-400">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-sm font-bold text-stone-900 dark:text-white">
                      Team
                    </h2>
                    <p className="text-xs text-stone-500 dark:text-zinc-500">
                      {members.length} member{members.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {/* Preview first 5 members */}
                <div className="mb-4 flex flex-wrap gap-2">
                  {members.slice(0, 5).map((member) => (
                    <div
                      key={member.id}
                      className="inline-flex items-center gap-2 rounded-full border border-stone-100 bg-stone-50 px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-800/50"
                    >
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-200 text-[10px] font-bold text-stone-600 dark:bg-zinc-700 dark:text-zinc-300">
                        {(member.profiles?.full_name?.[0] || member.email?.[0] || "?").toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-stone-700 dark:text-zinc-300">
                        {member.profiles?.full_name || member.email || "Unknown"}
                      </span>
                    </div>
                  ))}
                  {members.length > 5 && (
                    <span className="inline-flex items-center rounded-full border border-stone-100 bg-stone-50 px-3 py-1.5 text-xs text-stone-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-500">
                      +{members.length - 5} more
                    </span>
                  )}
                </div>

                <Link
                  href={`/organizations/${orgId}/settings/team`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Manage team
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>

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
    </DirectionalTransition>
  );
}