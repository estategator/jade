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
  const [orgs, setOrgs] = useState<(Organization & { myRole: OrgMember["role"] })[]>([]);
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
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {orgs.map((org) => {
              const badge = roleBadge[org.myRole];
              const BadgeIcon = badge.Icon;
              return (
                <Link
                  key={org.id}
                  href={`/organizations/${org.id}`}
                  className="group rounded-2xl border border-stone-200 bg-white p-6 transition-all hover:border-indigo-200 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-800"
                >
                  {org.cover_image_url ? (
                    <div className="relative mb-4 h-11 w-11 overflow-hidden rounded-xl">
                      <Image
                        src={org.cover_image_url}
                        alt={org.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                      <Building2 className="h-5 w-5" />
                    </div>
                  )}
                  <h3 className="text-base font-semibold text-stone-900 dark:text-white">
                    {org.name}
                  </h3>
                  <p className="mt-1 text-xs text-stone-500 dark:text-zinc-500">
                    /{org.slug}
                  </p>
                  <div className="mt-4 flex items-center gap-2 flex-wrap">
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
                </Link>
              );
            })}
          </motion.div>
        )}
    </div>
  );
}
