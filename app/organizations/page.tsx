"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Loader2,
  LogOut,
  Plus,
  Building2,
  Crown,
  Shield,
  User,
  Users,
  ChevronRight,
  Calendar,
} from "lucide-react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/app/components/page-header";
import {
  getOrganizations,
  type Organization,
  type OrgMember,
} from "@/app/organizations/actions";
import { TierBadge } from "@/app/components/tier-badge";
import { type SubscriptionTier } from "@/lib/tiers";

const roleBadge: Record<OrgMember["role"], { label: string; color: string; Icon: typeof Crown }> = {
  superadmin: { label: "Super Admin", color: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400", Icon: Crown },
  admin: { label: "Admin", color: "bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400", Icon: Shield },
  member: { label: "Member", color: "bg-stone-100 text-stone-600 dark:bg-zinc-800 dark:text-zinc-400", Icon: User },
};

export default function OrganizationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<(Organization & { myRole: OrgMember["role"]; memberCount: number })[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async (userId: string) => {
    const result = await getOrganizations(userId);
    if (result.error) {
      setError(result.error);
    } else {
      setOrgs(result.data ?? []);
    }
    setLoading(false);
  }, []);

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
    }
    checkAuth();
  }, [router, load]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
          title="Organizations"
          description={`Manage your teams, projects, and billing — ${orgs.length} ${orgs.length === 1 ? "organization" : "organizations"}.`}
          actions={[
            { label: "New organization", href: "/organizations/new", icon: Plus, variant: "primary" },
          ]}
        />

        {error && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400"
          >
            {error}
          </motion.p>
        )}

        {orgs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900"
          >
            <Building2 className="mx-auto mb-4 h-10 w-10 text-stone-400 dark:text-zinc-600" />
            <h3 className="text-lg font-bold text-stone-900 dark:text-white">
              No organizations yet
            </h3>
            <p className="mt-2 text-sm text-stone-600 dark:text-zinc-400">
              Create your first organization to start collaborating with your team.
            </p>
            <Link
              href="/organizations/new"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              New organization
            </Link>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {orgs.map((org, idx) => {
              const badge = roleBadge[org.myRole];
              const BadgeIcon = badge.Icon;
              const createdDate = org.created_at
                ? new Date(org.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })
                : null;
              return (
                <motion.div
                  key={org.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 * idx }}
                >
                  <Link
                    href={`/organizations/${org.id}`}
                    className="group flex h-full flex-col rounded-2xl border border-stone-200 bg-white transition-all hover:border-indigo-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700 dark:focus-visible:ring-offset-zinc-950"
                  >
                    {/* Card header */}
                    <div className="flex items-start gap-4 p-5 pb-0">
                      {org.cover_image_url ? (
                        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl ring-1 ring-stone-200 dark:ring-zinc-700">
                          <Image
                            src={org.cover_image_url}
                            alt={org.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:ring-indigo-900/40">
                          <Building2 className="h-5.5 w-5.5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-base font-semibold text-stone-900 dark:text-white">
                            {org.name}
                          </h3>
                          <ChevronRight className="h-4 w-4 flex-shrink-0 text-stone-400 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 dark:text-zinc-500" />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-stone-500 dark:text-zinc-500">
                          /{org.slug}
                        </p>
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-2 px-5 pt-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.color}`}
                      >
                        <BadgeIcon className="h-3 w-3" />
                        {badge.label}
                      </span>
                      <TierBadge
                        tier={(org.subscription_tier ?? "free") as SubscriptionTier}
                      />
                    </div>

                    {/* Card footer — metadata */}
                    <div className="mt-auto border-t border-stone-100 px-5 py-3 dark:border-zinc-800">
                      <div className="flex items-center gap-4 text-xs text-stone-500 dark:text-zinc-500">
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          {org.memberCount} {org.memberCount === 1 ? "member" : "members"}
                        </span>
                        {createdDate && (
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {createdDate}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}
    </div>
  );
}
