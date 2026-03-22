import Link from "next/link";
import { ArrowLeft, Package, TrendingUp, Megaphone, CreditCard, Users, Zap } from "lucide-react";

const SECTIONS = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Zap,
    content: [
      {
        heading: "Create your account",
        text: "Sign up with your email or Google account. After logging in, you'll be prompted to create your first organization — this is your workspace for managing estate sales.",
      },
      {
        heading: "Set up your organization",
        text: "Give your organization a name and invite team members. Free plans support 1 member; upgrade to Pro for up to 5 members or Enterprise for unlimited.",
      },
      {
        heading: "Add your first items",
        text: "Navigate to the Inventory page and click 'Add Item'. Upload a photo, add a description, and our AI will suggest a competitive price based on market data.",
      },
    ],
  },
  {
    id: "inventory",
    title: "Inventory Management",
    icon: Package,
    content: [
      {
        heading: "Adding items",
        text: "Use the Add Item form to create individual items with photos, descriptions, and categories. Our AI processes images to identify items and suggest pricing.",
      },
      {
        heading: "Bulk import",
        text: "For large estates, use the Bulk Add feature to upload multiple items simultaneously. Add photos and basic descriptions — the AI handles the rest.",
      },
      {
        heading: "QR code labels",
        text: "Generate printable QR codes for each item. Buyers can scan the code at your sale to see item details and pricing on their phone.",
      },
      {
        heading: "Editing & organizing",
        text: "Edit items anytime to update photos, descriptions, or pricing. Use projects to group items by estate sale or location.",
      },
    ],
  },
  {
    id: "pricing",
    title: "AI-Powered Pricing",
    icon: TrendingUp,
    content: [
      {
        heading: "How it works",
        text: "Upload a photo and description of your item. Our AI analyzes visual features, identifies the item type, and cross-references market data to suggest a competitive price.",
      },
      {
        heading: "Basic vs. Advanced AI",
        text: "Basic AI (all plans) provides essential valuations. Pro and Enterprise plans unlock Advanced AI with deeper market analysis, trend predictions, and comparable sales data.",
      },
      {
        heading: "Price optimization",
        text: "The Pricing Optimization page shows suggested price adjustments based on market trends, time-on-market data, and comparable recent sales in your area.",
      },
    ],
  },
  {
    id: "marketing",
    title: "Marketing Tools",
    icon: Megaphone,
    content: [
      {
        heading: "Creating materials",
        text: "Use the Marketing section to generate professional flyers, social media posts, and email campaigns for your estate sales using AI-powered templates.",
      },
      {
        heading: "Templates",
        text: "Choose from a library of pre-designed templates. Customize colors, images, text, and layout to match your brand.",
      },
      {
        heading: "Sharing",
        text: "Download your materials as images or PDFs. Share directly to social media platforms or send via email to your mailing list.",
      },
    ],
  },
  {
    id: "billing",
    title: "Billing & Plans",
    icon: CreditCard,
    content: [
      {
        heading: "Plan comparison",
        text: "Free: 1 member, basic AI. Pro ($50/mo): 5 members, advanced AI, Stripe integration. Enterprise: unlimited members, priority support, custom integrations.",
      },
      {
        heading: "Upgrading",
        text: "Visit the Pricing page or Organization Settings > Billing. Click Upgrade on your desired plan to start a secure Stripe checkout.",
      },
      {
        heading: "Managing your subscription",
        text: "Access the Stripe billing portal from Organization Settings > Billing to update payment methods, view invoices, or cancel your subscription.",
      },
      {
        heading: "Stripe Connect",
        text: "Pro and Enterprise plans can connect their own Stripe account to accept buyer payments directly at estate sales. Set this up in Organization Settings > Billing.",
      },
    ],
  },
  {
    id: "team",
    title: "Team Management",
    icon: Users,
    content: [
      {
        heading: "Inviting members",
        text: "Go to Organization Settings > Team and click 'Invite Member'. Enter the person's email and choose their role (Admin or Member).",
      },
      {
        heading: "Roles & permissions",
        text: "Superadmin: full control. Admin: manage team, settings, inventory. Member: create and edit inventory and marketing materials.",
      },
      {
        heading: "Switching organizations",
        text: "If you belong to multiple organizations, use the org switcher in the sidebar to switch between workspaces.",
      },
    ],
  },
];

interface DocsPageContentProps {
  /** Route prefix for back-link, e.g. "/help" or "/dashboard/help" */
  basePath: string;
}

export function DocsPageContent({ basePath }: Readonly<DocsPageContentProps>) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <Link
        href={basePath}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Help Center
      </Link>

      <h1 className="mb-2 text-3xl font-bold text-stone-900 dark:text-white sm:text-4xl">
        Documentation
      </h1>
      <p className="mb-10 text-sm text-stone-600 dark:text-zinc-400">
        Everything you need to know about using Curator for your estate sales.
      </p>

      {/* Table of contents */}
      <nav className="mb-10 rounded-xl border border-stone-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold text-stone-900 dark:text-white">
          Contents
        </h2>
        <ul className="space-y-1.5">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="inline-flex items-center gap-2 text-sm text-[var(--color-brand-primary)] transition-colors hover:opacity-80"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {section.title}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Sections */}
      <div className="space-y-12">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.id} id={section.id}>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-brand-subtle)] text-[var(--color-brand-primary)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-bold text-stone-900 dark:text-white">
                  {section.title}
                </h2>
              </div>
              <div className="space-y-4">
                {section.content.map((item) => (
                  <div
                    key={item.heading}
                    className="rounded-lg border border-stone-100 bg-stone-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
                  >
                    <h3 className="mb-1 text-sm font-semibold text-stone-800 dark:text-zinc-200">
                      {item.heading}
                    </h3>
                    <p className="text-sm leading-relaxed text-stone-600 dark:text-zinc-400">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
