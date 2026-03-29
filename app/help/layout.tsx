import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Help Center',
  description:
    'Get help with Curator — browse documentation, watch tutorials, read FAQs, or contact our support team.',
  path: '/help',
});

export default function HelpLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
