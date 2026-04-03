import type { MetadataRoute } from 'next';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAllPosts } from '@/lib/blog';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://inventorytools.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/features`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/pricing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/help`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/help/docs`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/help/tutorials`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ];

  // Published project sales pages
  const { data: projects } = await supabaseAdmin
    .from('projects')
    .select('id, updated_at')
    .eq('published', true)
    .order('updated_at', { ascending: false });

  const projectRoutes: MetadataRoute.Sitemap = (projects ?? []).map((project) => ({
    url: `${BASE_URL}/sales/${project.id}`,
    lastModified: new Date(project.updated_at),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  // Published project items
  const publishedProjectIds = (projects ?? []).map((p) => p.id);
  let itemRoutes: MetadataRoute.Sitemap = [];

  if (publishedProjectIds.length > 0) {
    const { data: items } = await supabaseAdmin
      .from('inventory_items')
      .select('id, updated_at')
      .in('project_id', publishedProjectIds)
      .eq('status', 'available')
      .order('updated_at', { ascending: false })
      .limit(1000);

    itemRoutes = (items ?? []).map((item) => ({
      url: `${BASE_URL}/items/${item.id}`,
      lastModified: new Date(item.updated_at),
      changeFrequency: 'daily' as const,
      priority: 0.6,
    }));
  }

  // Blog routes
  const posts = getAllPosts();
  const blogRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    ...posts.map((post) => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt ?? post.publishedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];

  return [...staticRoutes, ...blogRoutes, ...projectRoutes, ...itemRoutes];
}
