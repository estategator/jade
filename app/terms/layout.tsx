import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Terms of Service',
  description:
    'Terms of Service for Curator — the AI-powered estate sales management platform. Covers account usage, subscriptions, data ownership, and more.',
  path: '/terms',
});

export default function TermsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
