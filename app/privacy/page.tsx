"use client";

import { motion } from "framer-motion";
import { Navbar } from "@/app/components/navbar";
import { Footer } from "@/app/components/footer";

const sections = [
  {
    title: "1. Information We Collect",
    subsections: [
      {
        heading: "Account Information",
        content:
          "When you create an account, we collect your name, email address, and authentication credentials. If you sign up via a third-party provider (e.g., Google), we receive your name and email from that provider.",
      },
      {
        heading: "Inventory & Sale Data",
        content:
          "We store the inventory items, photos, descriptions, pricing data, and sale records you create within the platform. This data is necessary to provide our core services — AI-powered pricing, catalog management, and payment processing.",
      },
      {
        heading: "Payment Information",
        content:
          "Payment processing is handled by Stripe. We do not store your full credit card number on our servers. Stripe collects and processes payment details in accordance with PCI DSS standards. We receive only a transaction summary and the last four digits of your card.",
      },
      {
        heading: "Usage & Analytics",
        content:
          "We collect anonymous usage data such as pages visited, features used, and performance metrics. This helps us improve the product and identify issues. We use privacy-respecting analytics tools and do not sell this data to third parties.",
      },
      {
        heading: "Device & Log Data",
        content:
          "When you access Curator, we automatically collect standard log information including your IP address, browser type, operating system, referring URL, and timestamps. This data is used for security, debugging, and service improvement.",
      },
    ],
  },
  {
    title: "2. How We Use Your Information",
    subsections: [
      {
        heading: "Providing & Improving the Service",
        content:
          "We use your data to operate the platform, process transactions, deliver AI-powered features (pricing suggestions, marketing generation), and continuously improve accuracy and performance.",
      },
      {
        heading: "Communications",
        content:
          "We may send you transactional emails (receipts, account alerts, security notifications) and, if you opt in, product updates and marketing communications. You can unsubscribe from marketing emails at any time.",
      },
      {
        heading: "Security & Fraud Prevention",
        content:
          "We use account and log data to detect and prevent unauthorized access, fraud, and abuse of the platform.",
      },
      {
        heading: "AI Model Training",
        content:
          "Aggregate, de-identified data (e.g., item categories, price ranges) may be used to improve our AI pricing models. We never use your personal information or identifiable inventory photos for model training without your explicit consent.",
      },
    ],
  },
  {
    title: "3. How We Share Your Information",
    subsections: [
      {
        heading: "Service Providers",
        content:
          "We share data with trusted third-party services that help us operate the platform — including Stripe (payments), Supabase (database hosting), AWS (infrastructure), and OpenAI (AI features). These providers are contractually bound to protect your data.",
      },
      {
        heading: "Legal Requirements",
        content:
          "We may disclose your information if required by law, regulation, legal process, or governmental request — or to protect the rights, property, and safety of Curator, our users, or the public.",
      },
      {
        heading: "Business Transfers",
        content:
          "If Curator is involved in a merger, acquisition, or asset sale, your data may be transferred as part of that transaction. We will notify you of any such change and any choices you may have.",
      },
      {
        heading: "With Your Consent",
        content:
          "We will share your personal information with third parties outside of the above scenarios only with your explicit consent.",
      },
    ],
  },
  {
    title: "4. Data Retention & Deletion",
    subsections: [
      {
        heading: "Retention",
        content:
          "We retain your data for as long as your account is active or as needed to provide services. If you delete your account, we will remove your personal data within 30 days, except where retention is required by law (e.g., tax records, transaction history).",
      },
      {
        heading: "Export",
        content:
          "You can export your inventory, sale records, and account data at any time from your account settings in CSV or PDF format. Your data is yours.",
      },
      {
        heading: "Deletion Requests",
        content:
          "To request complete deletion of your data, email privacy@curatorapp.com. We will process your request within 30 days and confirm once complete.",
      },
    ],
  },
  {
    title: "5. Security",
    subsections: [
      {
        heading: "Infrastructure",
        content:
          "Curator is hosted on SOC 2 compliant infrastructure. All data is encrypted at rest (AES-256) and in transit (TLS 1.3). Database backups are encrypted and stored in geographically separate regions.",
      },
      {
        heading: "Access Controls",
        content:
          "We enforce role-based access control internally. Only authorized personnel can access user data, and all access is logged and audited. We conduct regular security reviews and penetration testing.",
      },
      {
        heading: "Incident Response",
        content:
          "In the event of a data breach, we will notify affected users within 72 hours as required by applicable law, along with details of the breach and steps taken to mitigate it.",
      },
    ],
  },
  {
    title: "6. Your Rights",
    subsections: [
      {
        heading: "Access & Portability",
        content:
          "You have the right to access, correct, and export your personal data at any time through your account settings or by contacting us.",
      },
      {
        heading: "Opt-Out",
        content:
          "You can opt out of marketing communications, analytics tracking, and AI model training contributions at any time from your settings.",
      },
      {
        heading: "California Residents (CCPA)",
        content:
          "If you are a California resident, you have the right to know what personal data we collect, request its deletion, and opt out of any sale of personal information. Curator does not sell personal information.",
      },
      {
        heading: "EU/EEA Residents (GDPR)",
        content:
          "If you are located in the EU/EEA, you have additional rights including the right to erasure, restriction of processing, data portability, and the right to lodge a complaint with your local supervisory authority.",
      },
    ],
  },
  {
    title: "7. Cookies & Tracking",
    subsections: [
      {
        heading: "Essential Cookies",
        content:
          "We use essential cookies for authentication, session management, and security. These cannot be disabled without breaking core functionality.",
      },
      {
        heading: "Analytics Cookies",
        content:
          "We use privacy-respecting analytics to understand how the product is used. You can opt out of analytics cookies from your account settings.",
      },
      {
        heading: "No Third-Party Ad Tracking",
        content:
          "We do not use third-party advertising cookies or trackers. We do not participate in ad networks or retargeting programs.",
      },
    ],
  },
  {
    title: "8. Children\u2019s Privacy",
    subsections: [
      {
        heading: "",
        content:
          "Curator is not directed at children under 16. We do not knowingly collect personal information from children. If we learn that we have collected data from a child under 16, we will delete it promptly. If you believe a child has provided us with personal data, please contact us at privacy@curatorapp.com.",
      },
    ],
  },
  {
    title: "9. Changes to This Policy",
    subsections: [
      {
        heading: "",
        content:
          "We may update this Privacy Policy from time to time. When we make material changes, we will notify you by email or through a prominent notice on the platform at least 30 days before the changes take effect. Your continued use of Curator after the effective date constitutes acceptance of the updated policy.",
      },
    ],
  },
  {
    title: "10. Contact Us",
    subsections: [
      {
        heading: "",
        content:
          "If you have questions about this Privacy Policy or your data, contact us at privacy@curatorapp.com or write to:\n\nCurator Inc.\nPrivacy Team\nUnited States",
      },
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 font-sans selection:bg-stone-200 dark:selection:bg-zinc-800">
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
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-stone-900 dark:text-white mb-6">
              Privacy Policy
            </h1>
            <p className="text-lg sm:text-xl text-stone-600 dark:text-zinc-400 mb-4">
              Your privacy matters. This policy explains what data we collect,
              how we use it, and the choices you have.
            </p>
            <p className="text-sm text-stone-500 dark:text-zinc-500">
              Last updated: March 21, 2026
            </p>
          </motion.div>
        </section>

        {/* Content */}
        <section className="pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="space-y-12">
              {sections.map((section, sectionIndex) => (
                <motion.div
                  key={sectionIndex}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: sectionIndex * 0.03 }}
                >
                  <h2 className="text-2xl font-bold text-stone-900 dark:text-white mb-6">
                    {section.title}
                  </h2>
                  <div className="space-y-6">
                    {section.subsections.map((sub, subIndex) => (
                      <div
                        key={subIndex}
                        className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800"
                      >
                        {sub.heading && (
                          <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2">
                            {sub.heading}
                          </h3>
                        )}
                        <p className="text-stone-600 dark:text-zinc-400 leading-relaxed whitespace-pre-line">
                          {sub.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
