import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { resolveActiveOrgId } from '@/lib/rbac';
import { getMarketingAsset, getMarketingSourceImages } from '@/app/marketing/actions';
import { PageHeader } from '@/app/components/page-header';
import { MarketingEditor } from './editor';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MarketingEditPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const activeOrgId = await resolveActiveOrgId(user.id);

  if (!activeOrgId) {
    redirect('/marketing');
  }

  const [assetResult, imagesResult] = await Promise.all([
    getMarketingAsset(id, user.id, activeOrgId),
    getMarketingSourceImages(user.id, activeOrgId),
  ]);

  if (assetResult.error || !assetResult.data) {
    redirect('/marketing');
  }

  return (
    <main className="px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        title="Edit Material"
        description={assetResult.data.title}
        backLink={{ href: '/marketing', label: 'Back to marketing' }}
      />
      <MarketingEditor
        asset={assetResult.data}
        sourceImages={imagesResult.data ?? []}
        orgId={activeOrgId}
        userId={user.id}
      />
    </main>
  );
}
