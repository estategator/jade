import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'About',
  description:
    'Learn about Curator — the AI-powered estate sales platform modernizing how professionals price, manage, and sell estate items.',
  path: '/about',
});

export default function AboutLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
