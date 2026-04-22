"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  PiArrowRightDuotone,
  PiCaretDownDuotone,
  PiCheckCircleDuotone,
  PiLightningDuotone,
  PiSparkleDuotone,
  PiXCircleDuotone,
} from "react-icons/pi";
import { Navbar } from "@/app/components/navbar";
import { Footer } from "@/app/components/footer";
import { PricingCard } from "@/app/components/pricing-card";
import { TIERS } from "@/lib/tiers";

export default function PricingPage() {
  const router = useRouter();

  const handleSelectTier = (tierId: string) => {
    if (tierId === "free") {
      router.push("/login?next=/dashboard&intent=signup&tier=free");
    } else if (tierId === "pro") {
      router.push("/login?next=/dashboard&intent=upgrade&tier=pro");
    } else if (tierId === "enterprise") {
      router.push("/login?next=/dashboard&intent=upgrade&tier=enterprise");
    }
  };

  const faqs = [
    {
      question: "Can I upgrade or downgrade my plan anytime?",
      answer:
        "Yes. You can change your subscription plan at any time. Changes take effect immediately and we prorate your billing accordingly.",
    },
    {
      question: "What payment methods do you accept?",
      answer:
        "All major credit cards (Visa, Mastercard, American Express). Enterprise customers can arrange custom billing.",
    },
    {
      question: "Is there a free trial for Pro or Enterprise?",
      answer:
        "The Free tier gives you full access to get started. For Pro features, contact our sales team to arrange a trial tailored to your workflow.",
    },
    {
      question: "What happens if I reach my team member limit?",
      answer:
        "You'll see an option to upgrade your plan. Upgrading is instant—you can add more members the moment you're through checkout.",
    },
    {
      question: "Do you offer discounts for annual billing?",
      answer:
        "Annual billing is coming soon. Until then, reach out for custom enterprise pricing.",
    },
    {
      question: "Can I cancel anytime?",
      answer:
        "Absolutely. Cancel from your settings at any time. Your data remains accessible on the Free tier, or you can export it.",
    },
  ];

  const comparisonRows: {
    label: string;
    free: string | boolean;
    pro: string | boolean;
    enterprise: string | boolean;
  }[] = [
    { label: "Team members", free: "1", pro: "Up to 5", enterprise: "Unlimited" },
    { label: "Basic AI insights", free: true, pro: true, enterprise: true },
    { label: "Advanced AI features", free: false, pro: true, enterprise: true },
    { label: "Image processing", free: true, pro: true, enterprise: true },
    { label: "Stripe, Square & Clover", free: false, pro: true, enterprise: true },
    { label: "Priority support", free: false, pro: false, enterprise: true },
  ];

  const renderCell = (value: string | boolean) => {
    if (value === true) {
      return (
        <PiCheckCircleDuotone
          className="mx-auto h-5 w-5 text-emerald-600 dark:text-emerald-400"
          aria-hidden="true"
        />
      );
    }
    if (value === false) {
      return (
        <PiXCircleDuotone
          className="mx-auto h-5 w-5 text-stone-300 dark:text-zinc-700"
          aria-hidden="true"
        />
      );
    }
    return <span className="text-stone-700 dark:text-zinc-300">{value}</span>;
  };

  return (
    <div className="relative min-h-screen bg-white dark:bg-zinc-950 text-stone-900 dark:text-white font-body selection:bg-indigo-200 dark:selection:bg-indigo-900/40 overflow-x-hidden">
      {/* ── Modern background system ───────────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[820px] -z-10"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-stone-50 via-white to-white dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-950" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_0%,rgba(99,102,241,0.18),transparent_65%)] dark:bg-[radial-gradient(60%_55%_at_50%_0%,rgba(99,102,241,0.28),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(40%_35%_at_85%_5%,rgba(139,92,246,0.14),transparent_60%)] dark:bg-[radial-gradient(40%_35%_at_85%_5%,rgba(139,92,246,0.22),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(35%_35%_at_10%_20%,rgba(16,185,129,0.10),transparent_60%)] dark:bg-[radial-gradient(35%_35%_at_10%_20%,rgba(16,185,129,0.16),transparent_60%)]" />
        <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(68,64,60,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(68,64,60,0.06)_1px,transparent_1px)] dark:[background-image:linear-gradient(to_right,rgba(244,244,245,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(244,244,245,0.05)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black_30%,transparent_80%)]" />
      </div>

      <div className="relative z-10">
        <Navbar launchBadge="Launching Feb 2026" />
        <main>
          {/* ── Hero ─────────────────────────────────────── */}
          <section className="relative pt-28 pb-12 lg:pt-36 lg:pb-16">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-6 flex justify-center"
              >
                <span className="inline-flex items-center gap-2 rounded-full bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border border-stone-200 dark:border-zinc-800 pl-1 pr-4 py-1 text-xs sm:text-sm text-stone-600 dark:text-zinc-300 shadow-sm">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 text-white px-2.5 py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">
                    <PiSparkleDuotone className="w-3 h-3" aria-hidden="true" />
                    Pricing
                  </span>
                  <span className="font-medium">Start free, upgrade when you&apos;re ready</span>
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.05 }}
                className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-stone-900 dark:text-white mb-6 font-display leading-[1.02] text-balance"
              >
                Simple pricing.{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-500 bg-[length:200%_auto] animate-[hero-gradient_8s_ease_infinite]">
                  Priced for the way you sell.
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-lg sm:text-xl text-stone-600 dark:text-zinc-400 leading-relaxed font-body text-balance"
              >
                Choose the plan that fits your estate sales business. Everything you need to price, catalog, and sell—no surprises at checkout.
              </motion.p>
            </div>
          </section>

          {/* ── Pricing Cards ────────────────────────────── */}
          <section className="relative pb-24 sm:pb-28">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
                {Object.values(TIERS).map((tier) => (
                  <PricingCard
                    key={tier.id}
                    tier={tier}
                    isPopular={tier.popular}
                    onSelectTier={handleSelectTier}
                  />
                ))}
              </div>

              {/* Reassurance row */}
              <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-stone-500 dark:text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <PiCheckCircleDuotone className="w-4 h-4 text-emerald-500" aria-hidden="true" />
                  No credit card required
                </span>
                <span className="flex items-center gap-1.5">
                  <PiCheckCircleDuotone className="w-4 h-4 text-emerald-500" aria-hidden="true" />
                  Cancel anytime
                </span>
                <span className="flex items-center gap-1.5">
                  <PiCheckCircleDuotone className="w-4 h-4 text-emerald-500" aria-hidden="true" />
                  Prorated upgrades and downgrades
                </span>
              </div>
            </div>
          </section>

          {/* ── Feature Comparison ───────────────────────── */}
          <section className="relative py-28 sm:py-32 bg-stone-50 dark:bg-zinc-900/40 border-y border-stone-200/70 dark:border-zinc-800/70">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-2xl mb-12">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.18em] mb-5">
                  <span className="h-px w-8 bg-indigo-600/60 dark:bg-indigo-400/60" />
                  Compare
                </span>
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-stone-900 dark:text-white mb-5 font-display">
                  Every feature, side by side.
                </h2>
                <p className="text-lg text-stone-600 dark:text-zinc-400 font-body leading-relaxed">
                  The same catalog, the same AI—scaled to the size of your team.
                </p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6 }}
                className="overflow-hidden rounded-3xl bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 shadow-sm"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-stone-50/60 dark:bg-zinc-900/60 border-b border-stone-200 dark:border-zinc-800">
                        <th className="text-left py-5 px-6 font-semibold text-stone-900 dark:text-white">
                          Feature
                        </th>
                        {Object.values(TIERS).map((tier) => (
                          <th
                            key={tier.id}
                            className="text-center py-5 px-6 font-semibold text-stone-900 dark:text-white min-w-[140px]"
                          >
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-display text-base">{tier.name}</span>
                              {tier.popular && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                                  Popular
                                </span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200/70 dark:divide-zinc-800/70">
                      {comparisonRows.map((row, index) => (
                        <tr
                          key={index}
                          className="hover:bg-stone-50 dark:hover:bg-zinc-900/40 transition-colors"
                        >
                          <td className="py-4 px-6 text-stone-800 dark:text-zinc-200 font-medium">
                            {row.label}
                          </td>
                          <td className="py-4 px-6 text-center text-stone-600 dark:text-zinc-400">
                            {renderCell(row.free)}
                          </td>
                          <td className="py-4 px-6 text-center text-stone-600 dark:text-zinc-400">
                            {renderCell(row.pro)}
                          </td>
                          <td className="py-4 px-6 text-center text-stone-600 dark:text-zinc-400">
                            {renderCell(row.enterprise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </div>
          </section>

          {/* ── FAQ ──────────────────────────────────────── */}
          <section className="relative py-28 sm:py-32">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-12 text-center">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.18em] mb-5">
                  <span className="h-px w-8 bg-indigo-600/60 dark:bg-indigo-400/60" />
                  FAQ
                </span>
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-stone-900 dark:text-white mb-5 font-display">
                  Questions, answered.
                </h2>
                <p className="text-lg text-stone-600 dark:text-zinc-400 font-body leading-relaxed">
                  Everything you need to know about pricing, plans, and getting started.
                </p>
              </div>

              <div className="rounded-3xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 divide-y divide-stone-200 dark:divide-zinc-800 overflow-hidden">
                {faqs.map((faq, index) => (
                  <motion.details
                    key={index}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.4, delay: index * 0.04 }}
                    className="group p-6 sm:p-7 transition-colors hover:bg-stone-50 dark:hover:bg-zinc-900/40"
                  >
                    <summary className="flex items-center justify-between gap-4 font-semibold text-stone-900 dark:text-white cursor-pointer list-none font-display text-base sm:text-lg tracking-tight">
                      {faq.question}
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-300 shrink-0 transition-transform group-open:rotate-180">
                        <PiCaretDownDuotone className="w-3.5 h-3.5" aria-hidden="true" />
                      </span>
                    </summary>
                    <p className="mt-4 text-stone-600 dark:text-zinc-400 leading-relaxed">
                      {faq.answer}
                    </p>
                  </motion.details>
                ))}
              </div>
            </div>
          </section>

          {/* ── Final CTA ────────────────────────────────── */}
          <section className="relative pb-28 sm:pb-32">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] bg-zinc-950 text-white p-10 sm:p-16 lg:p-20 ring-1 ring-white/10"
              >
                <div aria-hidden="true" className="absolute inset-0 -z-10">
                  <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_20%_0%,rgba(99,102,241,0.45),transparent_60%)]" />
                  <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_90%_100%,rgba(139,92,246,0.35),transparent_65%)]" />
                  <div className="absolute inset-0 bg-[radial-gradient(40%_40%_at_60%_100%,rgba(16,185,129,0.2),transparent_65%)]" />
                  <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:52px_52px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_85%)]" />
                </div>

                <div className="relative grid lg:grid-cols-5 gap-10 lg:gap-16 items-center">
                  <div className="lg:col-span-3">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-xs font-medium text-white/90 uppercase tracking-[0.18em] mb-6">
                      <PiLightningDuotone className="w-3.5 h-3.5 text-indigo-300" aria-hidden="true" />
                      Ready when you are
                    </span>
                    <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight font-display mb-6 text-balance">
                      Start free today.<br />
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-violet-300 to-emerald-300">
                        Upgrade when you&apos;re ready.
                      </span>
                    </h2>
                    <p className="text-lg text-zinc-300 leading-relaxed font-body max-w-xl">
                      Every plan includes the AI pricing engine, one shared catalog, and modern payments. Start on Free—move up the moment your team grows.
                    </p>
                  </div>

                  <div className="lg:col-span-2 flex flex-col gap-3">
                    <button
                      onClick={() => handleSelectTier("free")}
                      className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-white text-zinc-900 hover:bg-zinc-100 text-base font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950 focus:ring-white/60 transition-all shadow-lg"
                    >
                      Get started free
                      <PiArrowRightDuotone className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => handleSelectTier("pro")}
                      className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-white/5 border border-white/15 text-white hover:bg-white/10 text-base font-semibold rounded-xl backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950 focus:ring-white/40 transition-all"
                    >
                      Choose Pro
                    </button>

                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-400">
                      <span className="flex items-center gap-1.5">
                        <PiCheckCircleDuotone className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                        No card required
                      </span>
                      <span className="flex items-center gap-1.5">
                        <PiCheckCircleDuotone className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                        Cancel anytime
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </div>
  );
}
