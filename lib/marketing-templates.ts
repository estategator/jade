// Global marketing template library.
// Templates are static presets users can choose when creating marketing materials.

export type MarketingTemplate = {
  id: string;
  name: string;
  category: 'social' | 'print' | 'email' | 'banner';
  description: string;
  defaultHeadline: string;
  defaultBody: string;
  defaultCta: string;
  aspectRatio: string; // e.g. '1:1', '16:9', '4:5'
  icon: string; // lucide icon name for display
};

export const MARKETING_TEMPLATES: MarketingTemplate[] = [
  // ── Social Media ──
  {
    id: 'social-sale-announcement',
    name: 'Sale Announcement',
    category: 'social',
    description: 'Eye-catching social post to announce an upcoming estate sale.',
    defaultHeadline: 'Estate Sale This Weekend!',
    defaultBody: 'Discover unique treasures at unbeatable prices. Furniture, antiques, collectibles and more.',
    defaultCta: 'See Details',
    aspectRatio: '1:1',
    icon: 'Megaphone',
  },
  {
    id: 'social-item-highlight',
    name: 'Item Spotlight',
    category: 'social',
    description: 'Highlight a single standout item from your inventory.',
    defaultHeadline: 'Featured Item',
    defaultBody: 'Don\'t miss this beautiful piece — available now at our estate sale.',
    defaultCta: 'Shop Now',
    aspectRatio: '4:5',
    icon: 'Sparkles',
  },
  {
    id: 'social-countdown',
    name: 'Sale Countdown',
    category: 'social',
    description: 'Build excitement with a countdown to your sale date.',
    defaultHeadline: 'Only 3 Days Left!',
    defaultBody: 'Our estate sale is almost here. Mark your calendar and shop early for the best picks.',
    defaultCta: 'Set Reminder',
    aspectRatio: '1:1',
    icon: 'Clock',
  },
  {
    id: 'social-testimonial',
    name: 'Customer Testimonial',
    category: 'social',
    description: 'Share a happy buyer quote to build trust and drive traffic.',
    defaultHeadline: '"Best estate sale I\'ve been to!"',
    defaultBody: 'Hear from our happy customers and see what makes our sales special.',
    defaultCta: 'Read More',
    aspectRatio: '1:1',
    icon: 'Quote',
  },

  // ── Print ──
  {
    id: 'print-flyer',
    name: 'Event Flyer',
    category: 'print',
    description: 'Printable flyer with sale details, date, and location.',
    defaultHeadline: 'Estate Sale',
    defaultBody: 'Join us for an incredible estate sale featuring furniture, art, jewelry, and much more. Everything must go!',
    defaultCta: 'Visit Us',
    aspectRatio: '4:5',
    icon: 'FileText',
  },
  {
    id: 'print-price-tag',
    name: 'Price Tag Sheet',
    category: 'print',
    description: 'Professional price tags to print and attach to items.',
    defaultHeadline: 'Item Name',
    defaultBody: 'Category · Condition',
    defaultCta: '$0.00',
    aspectRatio: '16:9',
    icon: 'Tag',
  },
  {
    id: 'print-yard-sign',
    name: 'Yard Sign',
    category: 'print',
    description: 'Bold yard sign for directional or entrance display.',
    defaultHeadline: 'ESTATE SALE →',
    defaultBody: 'Today & Tomorrow\n9 AM – 4 PM',
    defaultCta: '',
    aspectRatio: '16:9',
    icon: 'SignpostBig',
  },

  // ── Email ──
  {
    id: 'email-invitation',
    name: 'Sale Invitation',
    category: 'email',
    description: 'Email header image inviting recipients to your upcoming sale.',
    defaultHeadline: 'You\'re Invited',
    defaultBody: 'Be the first to browse our curated collection of estate sale treasures.',
    defaultCta: 'RSVP Now',
    aspectRatio: '16:9',
    icon: 'Mail',
  },
  {
    id: 'email-recap',
    name: 'Post-Sale Recap',
    category: 'email',
    description: 'Thank-you email header summarizing sale results.',
    defaultHeadline: 'Thanks for Visiting!',
    defaultBody: 'We had an amazing turnout. Stay tuned for our next event.',
    defaultCta: 'Subscribe',
    aspectRatio: '16:9',
    icon: 'PartyPopper',
  },

  // ── Banners ──
  {
    id: 'banner-website',
    name: 'Website Banner',
    category: 'banner',
    description: 'Wide banner for your website or listing page.',
    defaultHeadline: 'Browse Our Estate Sale',
    defaultBody: 'Hundreds of quality items at estate sale prices.',
    defaultCta: 'Shop Now',
    aspectRatio: '16:9',
    icon: 'LayoutDashboard',
  },
  {
    id: 'banner-marketplace',
    name: 'Marketplace Listing',
    category: 'banner',
    description: 'Optimized banner for online marketplace listings.',
    defaultHeadline: 'Estate Sale Collection',
    defaultBody: 'Vintage, antique, and modern items — priced to sell.',
    defaultCta: 'View All',
    aspectRatio: '16:9',
    icon: 'ShoppingBag',
  },
];

export const TEMPLATE_CATEGORIES = [
  { id: 'social' as const, label: 'Social Media' },
  { id: 'print' as const, label: 'Print' },
  { id: 'email' as const, label: 'Email' },
  { id: 'banner' as const, label: 'Banners' },
];

export function getTemplateById(id: string): MarketingTemplate | undefined {
  return MARKETING_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: MarketingTemplate['category']): MarketingTemplate[] {
  return MARKETING_TEMPLATES.filter((t) => t.category === category);
}
