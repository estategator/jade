import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { getMarketingAssets, getMarketingSourceImages } from './actions';
import { getProjects } from '@/app/organizations/actions';
import { PageHeader } from '@/app/components/page-header';
import { MarketingDashboard } from './_components/marketing-dashboard';

export const dynamic = 'force-dynamic';

export default async function MarketingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get('curator_active_org')?.value ?? null;

  if (!activeOrgId) {
    return (
      <main className="px-4 py-12 sm:px-6 lg:px-8">
        <PageHeader
          title="Marketing"
          description="Create marketing materials for your estate sales."
        />
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-stone-500 dark:text-zinc-400">
            Please select an organization from the sidebar to access marketing tools.
          </p>
        </div>
      </main>
    );
  }

  const [assetsResult, imagesResult, projectsResult] = await Promise.all([
    getMarketingAssets(user.id, activeOrgId),
    getMarketingSourceImages(user.id, activeOrgId),
    getProjects(activeOrgId),
  ]);

  return (
    <main className="px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        title="Marketing"
        description="Create and manage marketing materials for your estate sales."
      />
      <MarketingDashboard
        assets={assetsResult.data ?? []}
        sourceImages={imagesResult.data ?? []}
        projects={(projectsResult.data ?? []) as { id: string; name: string }[]}
        orgId={activeOrgId}
        userId={user.id}
        initialError={assetsResult.error || imagesResult.error}
      />
    </main>
  );
}
