"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
        "Yes! You can change your subscription plan at any time. Changes take effect immediately, and we'll prorate your billing accordingly.",
    },
    {
      question: "What payment methods do you accept?",
      answer:
        "We accept all major credit cards (Visa, Mastercard, American Express) and can set up custom enterprise billing arrangements.",
    },
    {
      question: "Is there a free trial for Pro or Enterprise?",
      answer:
        "The Free tier gives you full access to get started. For Pro features, contact our sales team to arrange a trial tailored to your needs.",
    },
    {
      question: "What happens if I reach my team member limit?",
      answer:
        "If you reach your team member limit, you'll see an option to upgrade your plan. Upgrading is instant and you can immediately add more members.",
    },
    {
      question: "Do you offer discounts for annual billing?",
      answer:
        "Annual billing is coming soon. Contact our sales team for custom enterprise pricing.",
    },
    {
      question: "Can I cancel anytime?",
      answer:
        "Absolutely. You can cancel your subscription anytime from your settings. Your data remains accessible on the Free tier, or you can export it.",
    },
  ];

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 font-sans selection:bg-stone-200 dark:selection:bg-zinc-800">
      <Navbar launchBadge="Launching Feb 2026" />
      <main>
        {/* Hero Section */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-stone-900 dark:text-white mb-6">
              Simple, transparent pricing
            </h1>
            <p className="text-lg sm:text-xl text-stone-600 dark:text-zinc-400 mb-8">
              Choose the perfect plan for your estate sales business. Start free, upgrade whenever you&apos;re ready.
            </p>
          </motion.div>
        </section>

        {/* Pricing Cards Section */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              {Object.values(TIERS).map((tier) => (
                <PricingCard
                  key={tier.id}
                  tier={tier}
                  isPopular={tier.popular}
                  onSelectTier={handleSelectTier}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Comparison Section */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-zinc-900/50">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 dark:text-white mb-4">
                Feature Comparison
              </h2>
              <p className="text-lg text-stone-600 dark:text-zinc-400">
                Everything you need to succeed with Curator
              </p>
            </motion.div>

            {/* Comparison Table */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="overflow-x-auto"
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-zinc-800">
                    <th className="text-left py-4 px-4 font-semibold text-stone-900 dark:text-white">
                      Feature
                    </th>
                    {Object.values(TIERS).map((tier) => (
                      <th
                        key={tier.id}
                        className="text-center py-4 px-4 font-semibold text-stone-900 dark:text-white"
                      >
                        {tier.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 dark:divide-zinc-800">
                  {[
                    { label: "Team members", free: "1", pro: "Up to 5", enterprise: "Unlimited" },
                    { label: "Basic AI insights", free: "Yes", pro: "Yes", enterprise: "Yes" },
                    { label: "Advanced AI features", free: "No", pro: "Yes", enterprise: "Yes" },
                    { label: "Image processing", free: "Yes", pro: "Yes", enterprise: "Yes" },
                    { label: "Stripe integration", free: "No", pro: "Yes", enterprise: "Yes" },
                    { label: "Priority support", free: "No", pro: "No", enterprise: "Yes" },
                  ].map((row, index) => (
                    <tr
                      key={index}
                      className="hover:bg-stone-50 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="py-4 px-4 text-stone-900 dark:text-white font-medium">
                        {row.label}
                      </td>
                      <td className="py-4 px-4 text-center text-stone-600 dark:text-zinc-400">
                        {row.free}
                      </td>
                      <td className="py-4 px-4 text-center text-stone-600 dark:text-zinc-400">
                        {row.pro}
                      </td>
                      <td className="py-4 px-4 text-center text-stone-600 dark:text-zinc-400">
                        {row.enterprise}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 dark:text-white mb-4">
                Frequently Asked Questions
              </h2>
              <p className="text-lg text-stone-600 dark:text-zinc-400">
                Everything you need to know about our pricing and plans
              </p>
            </motion.div>

            <div className="space-y-6">
              {faqs.map((faq, index) => (
                <motion.details
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="group border border-stone-200 dark:border-zinc-800 rounded-lg p-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors cursor-pointer"
                >
                  <summary className="flex items-center justify-between font-semibold text-stone-900 dark:text-white cursor-pointer list-none">
                    {faq.question}
                    <span className="text-indigo-600 dark:text-indigo-400 group-open:rotate-180 transition-transform">
                      ▼
                    </span>
                  </summary>
                  <p className="mt-3 text-stone-600 dark:text-zinc-400">
                    {faq.answer}
                  </p>
                </motion.details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-indigo-600 to-indigo-700 dark:from-indigo-900 dark:to-indigo-800">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl mx-auto text-center text-white"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ready to get started?
            </h2>
            <p className="text-lg mb-8 text-indigo-100">
              Choose a plan and start managing your estate sales with AI-powered insights today.
            </p>
            <button
              onClick={() => handleSelectTier("free")}
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-indigo-600 font-semibold rounded-xl hover:bg-indigo-50 transition-colors duration-200 shadow-lg hover:shadow-xl"
            >
              Get Started Free
            </button>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
