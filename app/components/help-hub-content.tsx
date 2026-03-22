"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  HelpCircle,
  BookOpen,
  PlayCircle,
  Mail,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/app/components/page-header";
import { FaqSection } from "@/app/components/faq-section";
import { ContactForm } from "@/app/components/contact-form";
import { getTicketLimits } from "@/app/help/actions";
import { getActiveOrgId } from "@/lib/active-org";
import type { SubscriptionTier } from "@/lib/tiers";
import { cn } from "@/lib/cn";

type Tab = "faq" | "contact" | "docs" | "tutorials";

interface HelpHubContentProps {
  /** Route prefix for help links, e.g. "/help" or "/dashboard/help" */
  basePath: string;
}

export function HelpHubContent({ basePath }: Readonly<HelpHubContentProps>) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<Tab>(
    initialTab === "contact" ? "contact" : "docs"
  );
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tier, setTier] = useState<SubscriptionTier>("free");

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setIsAuthenticated(true);
        const oid = getActiveOrgId();
        if (oid) {
          const limits = await getTicketLimits(oid);
          setTier(limits.tier);
        }
      }
      setLoading(false);
    }
    init();
  }, []);

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "docs", label: "Docs", icon: BookOpen },
    { id: "tutorials", label: "Tutorials", icon: PlayCircle },
    ...(!isAuthenticated
      ? [{ id: "contact" as Tab, label: "Contact Us", icon: Mail }]
      : []),
    { id: "faq", label: "FAQs", icon: HelpCircle },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400 dark:text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Help Center"
        description="Find answers, explore our docs, and get in touch."
      />

      {/* Tab navigation */}
      <div className="mb-8 flex flex-wrap gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1 dark:border-zinc-700 dark:bg-zinc-800/50">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white text-stone-900 shadow-sm dark:bg-zinc-900 dark:text-white"
                  : "text-stone-500 hover:text-stone-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === "faq" && <FaqSection tier={tier} />}

        {activeTab === "contact" && <ContactForm />}

        {activeTab === "docs" && <DocsContent basePath={basePath} />}

        {activeTab === "tutorials" && <TutorialsContent />}
      </motion.div>
    </div>
  );
}

// ── Inline sub-sections ──────────────────────────────────────

function DocsContent({ basePath }: { basePath: string }) {
  const docs = [
    {
      title: "Getting Started Guide",
      description: "Set up your first estate sale in minutes.",
      href: `${basePath}/docs`,
      icon: BookOpen,
    },
    {
      title: "Inventory Management",
      description: "Add, edit, bulk-import, and organize your items.",
      href: `${basePath}/docs#inventory`,
      icon: BookOpen,
    },
    {
      title: "AI Pricing",
      description: "How our AI analyzes and prices your items.",
      href: `${basePath}/docs#pricing`,
      icon: BookOpen,
    },
    {
      title: "Marketing Tools",
      description: "Create professional flyers, emails, and social media posts.",
      href: `${basePath}/docs#marketing`,
      icon: BookOpen,
    },
    {
      title: "Billing & Plans",
      description: "Manage your subscription, payments, and invoices.",
      href: `${basePath}/docs#billing`,
      icon: BookOpen,
    },
    {
      title: "Team Management",
      description: "Invite members, assign roles, and manage permissions.",
      href: `${basePath}/docs#team`,
      icon: BookOpen,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {docs.map((doc) => {
        const Icon = doc.icon;
        return (
          <Link
            key={doc.title}
            href={doc.href}
            className="group rounded-xl border border-stone-200 bg-white p-5 transition-colors hover:border-[var(--color-brand-primary)]/30 hover:bg-[var(--color-brand-subtle)] dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-[var(--color-brand-primary)]/40 dark:hover:bg-[var(--color-brand-subtle)]"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-subtle)] text-[var(--color-brand-primary)]">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-medium text-stone-900 group-hover:text-[var(--color-brand-primary)] dark:text-white">
                  {doc.title}
                </h3>
                <p className="mt-0.5 text-sm text-stone-500 dark:text-zinc-400">
                  {doc.description}
                </p>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function TutorialsContent() {
  const tutorials = [
    {
      title: "Quick Start: Your First Estate Sale",
      duration: "5 min",
      description: "A walkthrough of setting up your organization and adding your first inventory items.",
    },
    {
      title: "AI-Powered Item Pricing",
      duration: "3 min",
      description: "See how our AI analyzes photos and suggests competitive prices for your items.",
    },
    {
      title: "Creating Marketing Materials",
      duration: "4 min",
      description: "Design professional flyers and social posts for your estate sale in minutes.",
    },
    {
      title: "Bulk Import & QR Codes",
      duration: "6 min",
      description: "Import many items at once and generate QR code labels for your sale.",
    },
    {
      title: "Managing Your Team",
      duration: "3 min",
      description: "Invite team members, assign roles, and collaborate on estate sales.",
    },
    {
      title: "Stripe Integration & Payments",
      duration: "4 min",
      description: "Connect Stripe to accept payments directly from buyers at your sales.",
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500 dark:text-zinc-400">
        Video tutorials to help you get the most out of Curator.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {tutorials.map((tut) => (
          <div
            key={tut.title}
            className="group relative overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
          >
            {/* Placeholder thumbnail */}
            <div className="flex h-36 items-center justify-center bg-stone-100 dark:bg-zinc-800">
              <PlayCircle className="h-10 w-10 text-stone-300 transition-colors group-hover:text-[var(--color-brand-primary)] dark:text-zinc-600" />
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-stone-900 dark:text-white">
                  {tut.title}
                </h3>
                <span className="ml-2 shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {tut.duration}
                </span>
              </div>
              <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">
                {tut.description}
              </p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-stone-400 dark:text-zinc-500">
        More tutorials coming soon.
      </p>
    </div>
  );
}
