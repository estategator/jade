import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Privacy Policy',
  description:
    'How Curator collects, uses, and protects your data. Read our privacy policy covering account data, inventory information, payments, and analytics.',
  path: '/privacy',
});

export default function PrivacyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
