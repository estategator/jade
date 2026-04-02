"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  PiSpinnerDuotone,
  PiPlusDuotone,
  PiBuildingsDuotone,
  PiCrownDuotone,
  PiShieldCheckDuotone,
  PiUserDuotone,
  PiUsersDuotone,
  PiCalendarDuotone,
  PiArrowRightDuotone,
} from "react-icons/pi";
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

type PhosphorIcon = React.ComponentType<{ className?: string }>;

const roleBadge: Record<OrgMember["role"], { label: string; color: string; Icon: PhosphorIcon }> = {
  superadmin: {
    label: "Super Admin",
    color: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500/20 dark:bg-indigo-900/20 dark:text-indigo-400 dark:ring-indigo-500/20",
    Icon: PiCrownDuotone,
  },
  admin: {
    label: "Admin",
    color: "bg-violet-50 text-violet-700 ring-1 ring-violet-500/20 dark:bg-violet-900/20 dark:text-violet-400 dark:ring-violet-500/20",
    Icon: PiShieldCheckDuotone,
  },
  member: {
    label: "Member",
    color: "bg-stone-100 text-stone-600 ring-1 ring-stone-200/60 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700/60",
    Icon: PiUserDuotone,
  },
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
        <PiSpinnerDuotone className="h-8 w-8 animate-spin text-indigo-600" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
          title="Organizations"
          description={`Manage your teams, projects, and billing — ${orgs.length} ${orgs.length === 1 ? "organization" : "organizations"}.`}
          actions={[
            { label: "New organization", href: "/organizations/new", icon: PiPlusDuotone, variant: "primary" },
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
            <PiBuildingsDuotone className="mx-auto mb-4 h-10 w-10 text-stone-300 dark:text-zinc-600" aria-hidden="true" />
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
              <PiPlusDuotone className="h-4 w-4" aria-hidden="true" />
              New organization
            </Link>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
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
                    className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-all duration-300 hover:border-indigo-300 hover:shadow-xl hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700 dark:focus-visible:ring-offset-zinc-950"
                  >
                    {/* Cover band */}
                    <div className="relative h-28 w-full overflow-hidden bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-stone-100 dark:from-indigo-500/15 dark:via-violet-500/10 dark:to-zinc-900">
                      {org.cover_image_url ? (
                        <>
                          <Image
                            src={org.cover_image_url}
                            alt=""
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                            unoptimized
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-white/60 via-transparent to-transparent dark:from-zinc-900/70" />
                        </>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <PiBuildingsDuotone className="h-10 w-10 text-indigo-300/60 dark:text-indigo-700/40" aria-hidden="true" />
                        </div>
                      )}
                    </div>

                    {/* Avatar overlapping the cover band */}
                    <div className="relative -mt-7 ml-5">
                      {org.cover_image_url ? (
                        <div className="relative h-14 w-14 overflow-hidden rounded-xl ring-[3px] ring-white shadow-md dark:ring-zinc-900">
                          <Image
                            src={org.cover_image_url}
                            alt={org.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-[3px] ring-white shadow-md dark:bg-indigo-900/30 dark:text-indigo-400 dark:ring-zinc-900">
                          <PiBuildingsDuotone className="h-6 w-6" aria-hidden="true" />
                        </div>
                      )}
                    </div>

                    {/* Identity */}
                    <div className="px-5 pt-3 pb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-lg font-bold text-stone-900 dark:text-white">
                          {org.name}
                        </h3>
                        <PiArrowRightDuotone className="h-4 w-4 flex-shrink-0 text-stone-400 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100 dark:text-zinc-500" aria-hidden="true" />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-stone-500 dark:text-zinc-500">
                        /{org.slug}
                      </p>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-2 px-5 pt-2 pb-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.color}`}
                      >
                        <BadgeIcon className="h-3 w-3" aria-hidden="true" />
                        {badge.label}
                      </span>
                      <TierBadge
                        tier={(org.subscription_tier ?? "free") as SubscriptionTier}
                      />
                    </div>

                    {/* Footer — metadata */}
                    <div className="mt-auto border-t border-stone-100 bg-stone-50/50 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                      <div className="flex items-center gap-4 text-xs font-medium text-stone-500 dark:text-zinc-500">
                        <span className="inline-flex items-center gap-1.5">
                          <PiUsersDuotone className="h-3.5 w-3.5" aria-hidden="true" />
                          {org.memberCount} {org.memberCount === 1 ? "member" : "members"}
                        </span>
                        {createdDate && (
                          <span className="inline-flex items-center gap-1.5">
                            <PiCalendarDuotone className="h-3.5 w-3.5" aria-hidden="true" />
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
