"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Building2, Settings } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { useSettings } from "@/app/components/settings-provider";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const router = useRouter();
  const { activeOrgId, loading } = useSettings();

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      // If user has an active org, redirect to the organization settings
      if (activeOrgId) {
        router.replace(`/organizations/${activeOrgId}/settings`);
      }
    }
    if (!loading) {
      checkAuth();
    }
  }, [router, activeOrgId, loading]);

  if (loading || activeOrgId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title="Settings"
        description="Select an organization to manage its settings."
      />

      <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <Building2 className="mx-auto mb-4 h-10 w-10 text-stone-400 dark:text-zinc-600" />
        <h3 className="text-base font-semibold text-stone-900 dark:text-white">
          No organization selected
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-stone-500 dark:text-zinc-500">
          Use the organization switcher to select an org, or visit your
          organizations to manage settings.
        </p>
        <Link
          href="/organizations"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-indigo-700"
        >
          <Settings className="h-4 w-4" />
          Go to Organizations
        </Link>
      </div>
    </div>
  );
}
