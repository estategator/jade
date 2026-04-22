"use client";

import { motion } from "framer-motion";
import { Navbar } from "@/app/components/navbar";
import { Footer } from "@/app/components/footer";

const sections = [
  {
    title: "1. Acceptance of Terms",
    subsections: [
      {
        heading: "",
        content:
          'By accessing or using Curator ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Service. These Terms apply to all users, including visitors, registered users, and paying subscribers. Curator reserves the right to update these Terms at any time. Material changes will be communicated via email or in-app notice at least 30 days before taking effect.',
      },
    ],
  },
  {
    title: "2. Description of Service",
    subsections: [
      {
        heading: "",
        content:
          "Curator is an AI-powered estate sales management platform that provides inventory management, AI-assisted pricing, payment processing, team collaboration, marketing tools, and analytics. The Service is provided on a subscription basis with free and paid tiers. Feature availability varies by plan.",
      },
    ],
  },
  {
    title: "3. Accounts & Registration",
    subsections: [
      {
        heading: "Eligibility",
        content:
          "You must be at least 16 years old to create an account. By registering, you represent that the information you provide is accurate, complete, and current.",
      },
      {
        heading: "Account Security",
        content:
          "You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account. Notify us immediately at support@curatorapp.com if you suspect unauthorized access.",
      },
      {
        heading: "Organizations & Teams",
        content:
          "If you create or join an organization, the organization owner controls access and data within that organization. Organization admins may add or remove members, change roles, and manage billing. By joining an organization, you agree that the organization owner may have access to data you create within that organization.",
      },
    ],
  },
  {
    title: "4. Subscriptions & Billing",
    subsections: [
      {
        heading: "Plans",
        content:
          "Curator offers Free, Pro, and Enterprise plans. Plan details, pricing, and feature limits are listed on our Pricing page and may change with 30 days\u2019 notice.",
      },
      {
        heading: "Payment",
        content:
          "Paid subscriptions are billed monthly via Stripe. By subscribing, you authorize us to charge your payment method on a recurring basis until you cancel. All fees are in USD unless otherwise stated.",
      },
      {
        heading: "Cancellation & Refunds",
        content:
          "You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of the current billing period \u2014 you retain access to paid features until then. We do not offer prorated refunds for partial months. If you believe a charge was made in error, contact support@curatorapp.com within 30 days.",
      },
      {
        heading: "Downgrades",
        content:
          "If you downgrade from a paid plan to the Free plan, you may lose access to features and data that exceed Free-tier limits (e.g., additional team members, advanced AI features). We recommend exporting your data before downgrading.",
      },
    ],
  },
  {
    title: "5. Acceptable Use",
    subsections: [
      {
        heading: "You agree NOT to:",
        content:
          "\u2022 Use the Service for any illegal purpose or in violation of any applicable law\n\u2022 Upload content that infringes on the intellectual property rights of others\n\u2022 Attempt to reverse-engineer, decompile, or extract source code from the Service\n\u2022 Use automated scripts, bots, or scrapers to access the Service without permission\n\u2022 Interfere with or disrupt the integrity or performance of the Service\n\u2022 Share your account credentials with unauthorized third parties\n\u2022 Resell or redistribute the Service without written authorization from Curator\n\u2022 Upload malicious content, malware, or attempt to exploit vulnerabilities",
      },
      {
        heading: "Enforcement",
        content:
          "Violation of these rules may result in suspension or termination of your account. We reserve the right to remove content that violates these Terms without prior notice.",
      },
    ],
  },
  {
    title: "6. Intellectual Property",
    subsections: [
      {
        heading: "Our IP",
        content:
          "The Service, including its design, code, AI models, branding, and documentation, is owned by Curator Inc. and protected by copyright, trademark, and other intellectual property laws. Nothing in these Terms grants you a license to use our trademarks or trade dress.",
      },
      {
        heading: "Your Content",
        content:
          "You retain ownership of all content you upload to the Service (photos, inventory data, descriptions, sale records). By uploading content, you grant Curator a limited, non-exclusive license to store, display, and process that content solely to provide and improve the Service.",
      },
      {
        heading: "Feedback",
        content:
          "If you provide feature requests, suggestions, or feedback, we may use that feedback without obligation to you.",
      },
    ],
  },
  {
    title: "7. AI-Generated Content",
    subsections: [
      {
        heading: "Pricing Suggestions",
        content:
          "AI-generated pricing suggestions are estimates based on historical data and should not be treated as professional appraisals. You are solely responsible for the final pricing of your items. Curator does not guarantee the accuracy of AI valuations.",
      },
      {
        heading: "Marketing Content",
        content:
          "AI-generated marketing materials (descriptions, social media posts, flyers) are provided as drafts. You are responsible for reviewing, editing, and ensuring the accuracy of all generated content before publishing.",
      },
      {
        heading: "No Professional Advice",
        content:
          "The Service does not provide legal, financial, or appraisal advice. For high-value or unique items, we recommend consulting a certified appraiser.",
      },
    ],
  },
  {
    title: "8. Privacy",
    subsections: [
      {
        heading: "",
        content:
          "Your use of the Service is also governed by our Privacy Policy, which describes how we collect, use, and protect your personal information. By using Curator, you consent to the practices described in our Privacy Policy.",
      },
    ],
  },
  {
    title: "9. Third-Party Services",
    subsections: [
      {
        heading: "",
        content:
          "The Service integrates with third-party providers including Stripe (payments), Supabase (database), AWS (infrastructure), and OpenAI (AI features). Your use of these integrations is subject to each provider\u2019s own terms of service. Curator is not responsible for the availability, accuracy, or practices of third-party services.",
      },
    ],
  },
  {
    title: "10. Limitation of Liability",
    subsections: [
      {
        heading: "",
        content:
          'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. TO THE MAXIMUM EXTENT PERMITTED BY LAW, CURATOR INC. SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM: (A) YOUR USE OF OR INABILITY TO USE THE SERVICE; (B) ANY UNAUTHORIZED ACCESS TO OR USE OF OUR SERVERS AND/OR ANY PERSONAL INFORMATION STORED THEREIN; (C) ANY ERRORS OR OMISSIONS IN AI-GENERATED CONTENT, INCLUDING PRICING SUGGESTIONS.',
      },
      {
        heading: "Cap on Liability",
        content:
          "Our total aggregate liability for any claims arising from these Terms or the Service shall not exceed the greater of $100 USD or the total amounts you paid to Curator in the twelve (12) months preceding the claim.",
      },
    ],
  },
  {
    title: "11. Indemnification",
    subsections: [
      {
        heading: "",
        content:
          "You agree to indemnify and hold harmless Curator Inc., its officers, directors, employees, and agents from any claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys\u2019 fees) arising from: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any third-party rights; or (d) content you upload to the Service.",
      },
    ],
  },
  {
    title: "12. Termination",
    subsections: [
      {
        heading: "By You",
        content:
          "You may delete your account at any time from your account settings. Upon deletion, we will remove your personal data within 30 days, subject to legal retention requirements.",
      },
      {
        heading: "By Curator",
        content:
          "We may suspend or terminate your account if you violate these Terms, if your use poses a risk to the Service or other users, or for any other reason with 30 days\u2019 notice (except in cases of severe violations, where termination may be immediate).",
      },
      {
        heading: "Effect of Termination",
        content:
          "Upon termination, your right to use the Service ceases immediately. You may export your data before termination. Sections of these Terms that by their nature should survive (including Limitation of Liability, Indemnification, and Governing Law) will remain in effect.",
      },
    ],
  },
  {
    title: "13. Governing Law & Disputes",
    subsections: [
      {
        heading: "",
        content:
          "These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law principles. Any disputes arising from these Terms or the Service shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association (AAA). You and Curator both waive the right to a jury trial and the right to participate in a class action.",
      },
    ],
  },
  {
    title: "14. Severability",
    subsections: [
      {
        heading: "",
        content:
          "If any provision of these Terms is found to be unenforceable, that provision will be modified to the minimum extent necessary, and the remaining provisions will continue in full force and effect.",
      },
    ],
  },
  {
    title: "15. Contact",
    subsections: [
      {
        heading: "",
        content:
          "For questions about these Terms of Service, contact us at legal@curatorapp.com or write to:\n\nCurator Inc.\nLegal Team\nUnited States",
      },
    ],
  },
];

export default function TermsPage() {
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
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-stone-900 dark:text-white mb-6 font-display">
              Terms of Service
            </h1>
            <p className="text-lg sm:text-xl text-stone-600 dark:text-zinc-400 mb-4 font-body">
              Please read these terms carefully before using Curator.
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
                  <h2 className="text-2xl font-bold text-stone-900 dark:text-white mb-6 font-display">
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
