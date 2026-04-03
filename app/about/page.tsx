"use client";

import { motion } from "framer-motion";
import {
  Heart,
  Target,
  Lightbulb,
  Handshake,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/app/components/navbar";
import { Footer } from "@/app/components/footer";

const values = [
  {
    title: "People First",
    description:
      "Estate sales are deeply personal. We build technology that respects the emotional weight of the process while making the business side effortless.",
    icon: <Heart className="w-6 h-6" />,
  },
  {
    title: "Radical Simplicity",
    description:
      "If a feature takes more than a few taps, we redesign it. Every screen, every flow, every interaction is stripped to its most useful form.",
    icon: <Target className="w-6 h-6" />,
  },
  {
    title: "AI That Assists, Not Replaces",
    description:
      "Our AI suggests prices, writes descriptions, and generates marketing — but you always have the final word. Humans run the sale; Curator handles the busywork.",
    icon: <Lightbulb className="w-6 h-6" />,
  },
  {
    title: "Fair & Transparent",
    description:
      "Simple pricing, no hidden fees, no lock-in. Your data is yours — export everything, anytime. We earn your business every month.",
    icon: <Handshake className="w-6 h-6" />,
  },
];

const timeline = [
  {
    year: "2024",
    title: "The Idea",
    description:
      "After watching a family member struggle to price and sell a lifetime of belongings during an estate sale, we realized the industry was stuck in the spreadsheet era. We set out to change that.",
  },
  {
    year: "2025",
    title: "Building in the Open",
    description:
      "We partnered with estate sale professionals across the country to design the product from their perspective — not ours. Hundreds of hours of feedback shaped every feature.",
  },
  {
    year: "2026",
    title: "Launch",
    description:
      "Curator launches with AI-powered pricing, smart inventory management, integrated payments, and team collaboration — all in one platform built for the way estate sales actually work.",
  },
];

const stats = [
  { value: "50M+", label: "Auction records powering our AI" },
  { value: "2,000+", label: "Professionals on the waitlist" },
  { value: "3 sec", label: "Average time to price an item" },
  { value: "99.9%", label: "Uptime SLA for Pro & Enterprise" },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 font-sans selection:bg-stone-200 dark:selection:bg-zinc-800 font-body">
      <Navbar launchBadge="Launching Feb 2026" />
      <main>
        {/* Hero */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-stone-900 dark:text-white mb-6 font-display">
              Modernizing estate sales,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-brand-primary)] to-violet-600">
                one home at a time
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-stone-600 dark:text-zinc-400 leading-relaxed">
              Curator is the AI-powered platform that helps estate sale
              professionals price items instantly, manage inventory effortlessly,
              and close sales faster than ever before.
            </p>
          </motion.div>
        </section>

        {/* Mission */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-stone-100/50 dark:bg-zinc-900/30 border-t border-stone-200 dark:border-zinc-800">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 dark:text-white mb-6 font-display">
                  Our mission
                </h2>
                <p className="text-lg text-stone-600 dark:text-zinc-400 leading-relaxed mb-4">
                  Estate sales are one of the oldest forms of commerce — and one
                  of the least modernized. Professionals still rely on gut
                  instinct, handwritten tags, and cash boxes. Families are left
                  wondering whether they got fair value for a lifetime of
                  belongings.
                </p>
                <p className="text-lg text-stone-600 dark:text-zinc-400 leading-relaxed">
                  We&apos;re building Curator to bring transparency, speed, and
                  confidence to every estate sale. By combining AI-powered
                  pricing with modern inventory and payment tools, we help
                  professionals run better sales — and help families know their
                  belongings found the right new homes at the right prices.
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="grid grid-cols-2 gap-4"
              >
                {stats.map((stat, index) => (
                  <div
                    key={index}
                    className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 text-center"
                  >
                    <p className="text-2xl sm:text-3xl font-bold text-[var(--color-brand-primary)] mb-1">
                      {stat.value}
                    </p>
                    <p className="text-sm text-stone-600 dark:text-zinc-400">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 dark:text-white mb-4 font-display">
                What we believe
              </h2>
              <p className="text-lg text-stone-600 dark:text-zinc-400 max-w-2xl mx-auto">
                The principles that guide every product decision we make.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {values.map((value, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 hover:shadow-lg hover:border-[var(--color-brand-primary)]/20 dark:hover:border-[var(--color-brand-primary)]/40 transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-[var(--color-brand-subtle)] flex items-center justify-center mb-4 text-[var(--color-brand-primary)] group-hover:bg-[var(--color-brand-subtle)] transition-colors">
                    {value.icon}
                  </div>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2">
                    {value.title}
                  </h3>
                  <p className="text-sm text-stone-600 dark:text-zinc-400 leading-relaxed">
                    {value.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-stone-100/50 dark:bg-zinc-900/30 border-t border-stone-200 dark:border-zinc-800">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 dark:text-white mb-4 font-display">
                Our story
              </h2>
              <p className="text-lg text-stone-600 dark:text-zinc-400 max-w-2xl mx-auto">
                How Curator went from a personal frustration to a platform
                serving thousands.
              </p>
            </div>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-6 top-0 bottom-0 w-px bg-stone-200 dark:bg-zinc-800 hidden md:block" />
              <div className="space-y-12">
                {timeline.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.15 }}
                    className="flex gap-6"
                  >
                    <div className="relative shrink-0 hidden md:block">
                      <div className="w-12 h-12 rounded-full bg-[var(--color-brand-primary)] text-white flex items-center justify-center text-sm font-bold z-10 relative">
                        {item.year}
                      </div>
                    </div>
                    <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 flex-1">
                      <span className="text-xs font-semibold text-[var(--color-brand-primary)] bg-[var(--color-brand-subtle)] px-2 py-1 rounded-full md:hidden">
                        {item.year}
                      </span>
                      <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-2 mt-2 md:mt-0">
                        {item.title}
                      </h3>
                      <p className="text-stone-600 dark:text-zinc-400 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
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
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Join us on the journey
            </h2>
            <p className="text-lg mb-8 text-white/80">
              Whether you run one sale a year or fifty, Curator is built for
              you. Get started free — no credit card required.
            </p>
            <Link
              href="/login?next=/dashboard&intent=signup&tier=free"
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-[var(--color-brand-primary)] font-semibold rounded-xl hover:bg-stone-50 transition-colors duration-200 shadow-lg hover:shadow-xl"
            >
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </motion.div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
