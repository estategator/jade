import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { resolveActiveOrgId, hasPermission } from '@/lib/rbac';
import { getUserProjects } from '@/app/inventory/actions';
import { PricingOptimizationForm } from '@/app/components/pricing-optimization-form';
import { PageHeader } from '@/app/components/page-header';

export const dynamic = 'force-dynamic';

type PageProps = Readonly<{}>;

export default async function PricingOptimizationPage({}: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const activeOrgId = await resolveActiveOrgId(user.id);

  // ── Member access restriction ──────────────────────────
  if (activeOrgId) {
    const canViewPricing = await hasPermission(activeOrgId, user.id, 'analytics:view');
    if (!canViewPricing) {
      return (
        <main className="px-4 sm:px-6 lg:px-8 py-12">
          <PageHeader
            title="Pricing Optimization"
            description="AI-powered pricing for your inventory."
            backLink={{ href: '/inventory', label: 'Back to inventory' }}
          />
          <div className="mt-8 rounded-3xl border border-stone-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-bold text-stone-900 dark:text-white">Access Denied</h2>
            <p className="mt-2 text-sm text-stone-500 dark:text-zinc-400">
              You don&apos;t have permission to access pricing optimization. Contact an admin to request access.
            </p>
          </div>
        </main>
      );
    }
  }

  const projectsResult = await getUserProjects(user.id, activeOrgId);
  const projects = projectsResult.data ?? [];

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-12">
      <PageHeader
        title="Pricing Optimization"
        description="Upload item photos to get AI-powered pricing across Fair, Good, and Excellent conditions — then add results directly to your inventory."
        backLink={{ href: '/inventory', label: 'Back to inventory' }}
      />

      <PricingOptimizationForm projects={projects} userId={user.id} />
    </main>
  );
}
