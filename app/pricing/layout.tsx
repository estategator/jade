import { buildMetadata, faqJsonLd, SITE_URL } from '@/lib/seo';

const faqs = [
  { question: 'Can I upgrade or downgrade my plan anytime?', answer: 'Yes! You can change your subscription plan at any time. Changes take effect immediately, and we\'ll prorate your billing accordingly.' },
  { question: 'What payment methods do you accept?', answer: 'We accept all major credit cards (Visa, Mastercard, American Express) and can set up custom enterprise billing arrangements.' },
  { question: 'Is there a free trial for Pro or Enterprise?', answer: 'The Free tier gives you full access to get started. For Pro features, contact our sales team to arrange a trial tailored to your needs.' },
  { question: 'What happens if I reach my team member limit?', answer: 'If you reach your team member limit, you\'ll see an option to upgrade your plan. Upgrading is instant and you can immediately add more members.' },
  { question: 'Do you offer discounts for annual billing?', answer: 'Annual billing is coming soon. Contact our sales team for custom enterprise pricing.' },
  { question: 'Can I cancel anytime?', answer: 'Absolutely. You can cancel your subscription anytime from your settings. Your data remains accessible on the Free tier, or you can export it.' },
];

export const metadata = buildMetadata({
  title: 'Pricing',
  description:
    'Simple, transparent pricing for estate sale professionals. Start free, upgrade when you\'re ready. Compare Free, Pro, and Enterprise plans.',
  path: '/pricing',
});

export default function PricingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faqs)) }}
      />
      {children}
    </>
  );
}
