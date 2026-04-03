import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Blog',
  description:
    'Tips, guides, and insights for estate sale professionals — from AI-powered pricing to inventory management best practices.',
  path: '/blog',
});

export default function BlogLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
