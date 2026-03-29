import type { Metadata } from 'next';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://estategator.com';
export const SITE_NAME = 'Curator AI';
export const DEFAULT_DESCRIPTION =
  'AI-powered estate sales management. Price items instantly with AI, manage inventory, accept payments, and close sales faster.';

/**
 * Build page-level metadata with sensible defaults.
 * Pass `title` as a string for the page-specific title;
 * it will be templated as "Page | Curator AI" via the root layout template.
 */
export function buildMetadata(page: {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
  noIndex?: boolean;
}): Metadata {
  const url = `${SITE_URL}${page.path}`;
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      title: page.title,
      description: page.description,
      url,
      siteName: SITE_NAME,
      type: 'website',
      ...(page.ogImage ? { images: [{ url: page.ogImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
      ...(page.ogImage ? { images: [page.ogImage] } : {}),
    },
    ...(page.noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}

// ── JSON-LD helpers ──

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/android-chrome-512x512.png`,
    description: DEFAULT_DESCRIPTION,
  };
}

export function softwareAppJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };
}

export function faqJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function productJsonLd(product: {
  name: string;
  description: string;
  image?: string;
  price: number;
  currency?: string;
  url: string;
  condition?: string;
  availability?: 'InStock' | 'SoldOut';
  seller?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    ...(product.image ? { image: product.image } : {}),
    url: product.url,
    ...(product.condition ? { itemCondition: `https://schema.org/${product.condition === 'Excellent' ? 'NewCondition' : 'UsedCondition'}` } : {}),
    offers: {
      '@type': 'Offer',
      price: product.price.toFixed(2),
      priceCurrency: product.currency || 'USD',
      availability: `https://schema.org/${product.availability || 'InStock'}`,
      ...(product.seller ? { seller: { '@type': 'Organization', name: product.seller } } : {}),
    },
  };
}
