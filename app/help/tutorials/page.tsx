import Link from "next/link";
import { ArrowLeft, PlayCircle } from "lucide-react";

const TUTORIALS = [
  {
    title: "Quick Start: Your First Estate Sale",
    duration: "5 min",
    description:
      "A walkthrough of setting up your organization and adding your first inventory items.",
    category: "Getting Started",
  },
  {
    title: "AI-Powered Item Pricing",
    duration: "3 min",
    description:
      "See how our AI analyzes photos and suggests competitive prices for your items.",
    category: "Features",
  },
  {
    title: "Creating Marketing Materials",
    duration: "4 min",
    description:
      "Design professional flyers and social posts for your estate sale in minutes.",
    category: "Marketing",
  },
  {
    title: "Bulk Import & QR Codes",
    duration: "6 min",
    description:
      "Import many items at once and generate QR code labels for your sale.",
    category: "Inventory",
  },
  {
    title: "Managing Your Team",
    duration: "3 min",
    description:
      "Invite team members, assign roles, and collaborate on estate sales.",
    category: "Team",
  },
  {
    title: "Stripe Integration & Payments",
    duration: "4 min",
    description:
      "Connect Stripe to accept payments directly from buyers at your sales.",
    category: "Billing",
  },
  {
    title: "Advanced AI & Market Insights",
    duration: "5 min",
    description:
      "Unlock the full power of Curator's AI with trend analysis and comparable sales data.",
    category: "Features",
  },
  {
    title: "Price Optimization Strategies",
    duration: "4 min",
    description:
      "Use data-driven pricing to maximize revenue at your estate sales.",
    category: "Features",
  },
];

const CATEGORIES = [...new Set(TUTORIALS.map((t) => t.category))];

export default function TutorialsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/help"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Help Center
      </Link>

      <h1 className="mb-2 text-3xl font-bold text-stone-900 dark:text-white sm:text-4xl">
        Video Tutorials
      </h1>
      <p className="mb-10 text-sm text-stone-600 dark:text-zinc-400">
        Step-by-step video guides to help you get the most out of Curator.
      </p>

      {CATEGORIES.map((category) => (
        <section key={category} className="mb-10">
          <h2 className="mb-4 text-lg font-bold text-stone-900 dark:text-white">
            {category}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {TUTORIALS.filter((t) => t.category === category).map((tut) => (
              <div
                key={tut.title}
                className="group relative overflow-hidden rounded-xl border border-stone-200 bg-white transition-colors hover:border-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-indigo-700"
              >
                {/* Placeholder thumbnail */}
                <div className="flex h-40 items-center justify-center bg-stone-100 dark:bg-zinc-800">
                  <PlayCircle className="h-12 w-12 text-stone-300 transition-colors group-hover:text-indigo-500 dark:text-zinc-600 dark:group-hover:text-indigo-400" />
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
        </section>
      ))}

      <p className="text-center text-sm text-stone-400 dark:text-zinc-500">
        More tutorials coming soon. Have a suggestion?{" "}
        <Link
          href="/help"
          className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          Let us know
        </Link>
        .
      </p>
    </div>
  );
}
