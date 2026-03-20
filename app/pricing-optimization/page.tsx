import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
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

  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get('curator_active_org')?.value ?? null;

  const projectsResult = await getUserProjects(user.id, activeOrgId);
  const projects = projectsResult.data ?? [];

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-12">
      <PageHeader
        title="Pricing Optimization"
        description="Upload item images and get AI-powered price suggestions for each condition. Add results directly to your inventory."
        backLink={{ href: '/inventory', label: 'Back to inventory' }}
      />

      <PricingOptimizationForm projects={projects} userId={user.id} />
    </main>
  );
}
