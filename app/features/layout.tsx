import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Features',
  description:
    'AI-powered valuations, smart inventory management, instant payments, and team collaboration — every tool estate sale professionals need in one platform.',
  path: '/features',
});

export default function FeaturesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
