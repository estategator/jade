"use client";

import { motion } from "framer-motion";
import {
  Zap,
  BarChart3,
  Shield,
  Users,
  Camera,
  Tag,
  FileText,
  Bell,
  Globe,
  Smartphone,
  TrendingUp,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/app/components/navbar";
import { Footer } from "@/app/components/footer";

const coreFeatures = [
  {
    title: "AI-Powered Valuations",
    description:
      "Snap a photo and get an accurate price in seconds. Our AI analyzes millions of past auction records, eBay completed listings, and dealer databases to suggest a competitive market price — so you never leave money on the table.",
    icon: <Zap className="w-6 h-6" />,
    highlight: "3-second pricing",
    details: [
      "Trained on 50M+ auction & resale records",
      "Condition-aware pricing with multiple grade levels",
      "Comparable-sales view with source links",
      "Confidence score on every valuation",
    ],
  },
  {
    title: "Smart Inventory Management",
    description:
      "Automatically categorize and tag items as you scan. Build sortable, searchable catalogs for every estate — then share them online with a single link. Track what's sold, what's pending, and what's still available in real time.",
    icon: <BarChart3 className="w-6 h-6" />,
    highlight: "Auto-categorization",
    details: [
      "Bulk import via spreadsheet or photo batch",
      "Auto-generated item descriptions for listings",
      "QR code labels for fast in-person checkout",
      "Export to CSV, PDF, or shareable web catalog",
    ],
  },
  {
    title: "Instant Payments & Invoicing",
    description:
      "Accept credit cards on-site or online using our integrated Stripe checkout. Send professional branded invoices, issue receipts automatically, and reconcile earnings at the end of the sale — no separate POS needed.",
    icon: <Shield className="w-6 h-6" />,
    highlight: "Stripe-powered",
    details: [
      "Tap-to-pay, card reader, and online checkout",
      "Automatic receipt emails to buyers",
      "Sales tax calculation by jurisdiction",
      "End-of-sale financial summary & payout tracking",
    ],
  },
  {
    title: "Team Collaboration",
    description:
      "Run multi-person estate sales without the chaos. Invite team members, assign granular roles (owner, manager, staff), and sync changes in real time across every device so everyone stays on the same page.",
    icon: <Users className="w-6 h-6" />,
    highlight: "Multi-user access",
    details: [
      "Role-based access control (RBAC)",
      "Activity feed with attribution per team member",
      "Organization-level billing & settings",
      "Real-time sync across all devices",
    ],
  },
];

const additionalFeatures = [
  {
    title: "Photo-First Scanning",
    description:
      "Point your phone camera at any item. Curator identifies it, fills in details, and suggests a price — all before you type a single word.",
    icon: <Camera className="w-6 h-6" />,
  },
  {
    title: "Dynamic Pricing Rules",
    description:
      "Set automatic markdowns by day, category, or remaining inventory. Run a \"50% off everything Sunday\" sale with one toggle.",
    icon: <Tag className="w-6 h-6" />,
  },
  {
    title: "AI Marketing Materials",
    description:
      "Generate social media posts, sale flyers, and email blasts from your inventory photos. On-brand content in seconds, not hours.",
    icon: <FileText className="w-6 h-6" />,
  },
  {
    title: "Smart Notifications",
    description:
      "Get alerts when high-value items are priced below market, when a sale hits revenue milestones, or when buyer inquiries come in.",
    icon: <Bell className="w-6 h-6" />,
  },
  {
    title: "Public Sale Pages",
    description:
      "Each sale gets a beautiful, shareable web page with photos, maps, dates, and live inventory — automatically generated from your catalog.",
    icon: <Globe className="w-6 h-6" />,
  },
  {
    title: "Mobile-First Design",
    description:
      "Built for the field. Every feature works flawlessly on phones and tablets — scan, price, sell, and manage from anywhere.",
    icon: <Smartphone className="w-6 h-6" />,
  },
  {
    title: "Analytics & Reporting",
    description:
      "Track revenue, average item value, sell-through rate, and top categories. Spot trends across sales and make smarter decisions.",
    icon: <TrendingUp className="w-6 h-6" />,
  },
  {
    title: "Enterprise-Grade Security",
    description:
      "SOC 2 compliant infrastructure, encrypted data at rest and in transit, and fine-grained access control for every team member.",
    icon: <Lock className="w-6 h-6" />,
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 font-sans selection:bg-stone-200 dark:selection:bg-zinc-800 font-body">
      <Navbar launchBadge="Now in early access" />
      <main>
        {/* Hero */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center"
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] text-sm font-medium mb-6 border border-[var(--color-brand-primary)]/20">
              <Zap className="w-4 h-4" />
              Built for estate sale professionals
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-stone-900 dark:text-white mb-6 font-display">
              Every tool you need, in one platform
            </h1>
            <p className="text-lg sm:text-xl text-stone-600 dark:text-zinc-400 leading-relaxed">
              From the moment you walk into an estate to the final payout, Curator handles pricing, inventory, payments, marketing, and analytics — so you can focus on selling.
            </p>
          </motion.div>
        </section>

        {/* Core Features — detailed cards */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-stone-100/50 dark:bg-zinc-900/30 border-t border-stone-200 dark:border-zinc-800">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 dark:text-white mb-4 font-display">
                Core capabilities
              </h2>
              <p className="text-lg text-stone-600 dark:text-zinc-400 max-w-2xl mx-auto">
                The four pillars that make Curator the most complete estate sales platform on the market.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {coreFeatures.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="p-8 rounded-2xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 hover:shadow-lg hover:border-[var(--color-brand-primary)]/20 dark:hover:border-[var(--color-brand-primary)]/40 transition-all group"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-[var(--color-brand-subtle)] flex items-center justify-center text-[var(--color-brand-primary)] shrink-0 group-hover:bg-[var(--color-brand-subtle)] transition-colors">
                      {feature.icon}
                    </div>
                    <div>
                      <span className="inline-block text-xs font-semibold text-[var(--color-brand-primary)] bg-[var(--color-brand-subtle)] px-2 py-1 rounded-full mb-2">
                        {feature.highlight}
                      </span>
                      <h3 className="text-xl font-bold text-stone-900 dark:text-white">
                        {feature.title}
                      </h3>
                    </div>
                  </div>
                  <p className="text-stone-600 dark:text-zinc-400 leading-relaxed mb-6 font-body">
                    {feature.description}
                  </p>
                  <ul className="space-y-2">
                    {feature.details.map((detail, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-stone-600 dark:text-zinc-400">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--color-brand-primary)] shrink-0" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Additional Features — compact grid */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 dark:text-white mb-4 font-display">
                And so much more
              </h2>
              <p className="text-lg text-stone-600 dark:text-zinc-400 max-w-2xl mx-auto">
                Every detail has been designed for the way estate sale professionals actually work.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {additionalFeatures.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 hover:shadow-lg hover:border-[var(--color-brand-primary)]/20 dark:hover:border-[var(--color-brand-primary)]/40 transition-all group"
                >
                  <div className="w-10 h-10 rounded-lg bg-[var(--color-brand-subtle)] flex items-center justify-center mb-4 text-[var(--color-brand-primary)] group-hover:bg-[var(--color-brand-subtle)] transition-colors">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2 font-display">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-stone-600 dark:text-zinc-400 leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-stone-100/50 dark:bg-zinc-900/30 border-t border-stone-200 dark:border-zinc-800">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 dark:text-white mb-4 font-display">
                How it works
              </h2>
              <p className="text-lg text-stone-600 dark:text-zinc-400 max-w-2xl mx-auto">
                Three simple steps — from walkthrough to payout.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "01",
                  title: "Scan & Price",
                  description:
                    "Walk through the estate snapping photos. Curator identifies each item, suggests a market price, and adds it to your catalog automatically.",
                },
                {
                  step: "02",
                  title: "Organize & Publish",
                  description:
                    "Review your catalog, tweak prices if needed, then publish a professional sale page. Share it on social media with AI-generated marketing content.",
                },
                {
                  step: "03",
                  title: "Sell & Get Paid",
                  description:
                    "Accept payments on-site or online. Track every transaction, generate receipts, and get a complete financial summary when the sale closes.",
                },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15 }}
                  className="text-center"
                >
                  <div className="w-14 h-14 rounded-2xl bg-[var(--color-brand-primary)] text-white flex items-center justify-center text-xl font-bold mx-auto mb-6">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-3">
                    {item.title}
                  </h3>
                  <p className="text-stone-600 dark:text-zinc-400 leading-relaxed">
                    {item.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-primary-hover)] dark:from-[var(--color-brand-primary)]/60 dark:to-[var(--color-brand-primary-hover)]/60">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl mx-auto text-center text-white"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 font-display">
              Ready to see it in action?
            </h2>
            <p className="text-lg mb-8 text-white/80">
              Start with the free plan and upgrade as your business grows. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center px-8 py-4 bg-white text-[var(--color-brand-primary)] font-semibold rounded-xl hover:bg-stone-50 transition-colors duration-200 shadow-lg hover:shadow-xl"
              >
                View Pricing
              </Link>
              <Link
                href="/login?next=/dashboard&intent=signup&tier=free"
                className="inline-flex items-center justify-center px-8 py-4 bg-[var(--color-brand-primary)] text-white font-semibold rounded-xl hover:bg-[var(--color-brand-primary-hover)] transition-colors duration-200 border border-[var(--color-brand-primary)]"
              >
                Get Started Free
              </Link>
            </div>
          </motion.div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
