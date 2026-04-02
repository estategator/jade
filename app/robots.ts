import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://inventorytools.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          '/dashboard/',
          '/settings/',
          '/organizations/',
          '/inventory/',
          '/contracts/',
          '/invoices/',
          '/notifications/',
          '/onboarding/',
          '/support/',
          '/tickets/',
          '/cart/',
          '/checkout/',
          '/login/',
          '/client/',
          '/clients/',
          '/pricing-optimization/',
          '/upgrade/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
