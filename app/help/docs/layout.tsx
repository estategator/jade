import { buildMetadata, breadcrumbJsonLd, SITE_URL } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Documentation',
  description:
    'Curator documentation — getting started, inventory management, AI pricing, marketing tools, billing, and team management guides.',
  path: '/help/docs',
});

export default function DocsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: 'Help', url: `${SITE_URL}/help` },
              { name: 'Documentation', url: `${SITE_URL}/help/docs` },
            ]),
          ),
        }}
      />
      {children}
    </>
  );
}
