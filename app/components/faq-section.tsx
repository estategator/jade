"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  type FaqItem,
  type FaqCategory,
  FAQ_CATEGORIES,
  getFaqs,
  searchFaqs,
} from "@/lib/faqs";
import type { SubscriptionTier } from "@/lib/tiers";

type FaqSectionProps = Readonly<{
  tier?: SubscriptionTier;
}>;

export function FaqSection({ tier = "free" }: FaqSectionProps) {
  const [activeCategory, setActiveCategory] = useState<FaqCategory | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const faqs: FaqItem[] = searchQuery
    ? searchFaqs(searchQuery, tier)
    : getFaqs(tier, activeCategory ?? undefined);

  function handleToggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-zinc-500" />
        <input
          type="text"
          placeholder="Search FAQs..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setExpandedId(null);
          }}
          className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-4 text-sm text-stone-900 placeholder:text-stone-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-indigo-500"
        />
      </div>

      {/* Category tabs */}
      {!searchQuery && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveCategory(null);
              setExpandedId(null);
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              activeCategory === null
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                : "text-stone-500 hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            )}
          >
            All
          </button>
          {FAQ_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setActiveCategory(cat.id);
                setExpandedId(null);
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                activeCategory === cat.id
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                  : "text-stone-500 hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* FAQ accordion */}
      <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white dark:divide-zinc-800 dark:border-zinc-700 dark:bg-zinc-900">
        {faqs.length === 0 ? (
          <div className="p-6 text-center text-sm text-stone-500 dark:text-zinc-400">
            {searchQuery
              ? "No FAQs match your search."
              : "No FAQs in this category."}
          </div>
        ) : (
          faqs.map((faq) => (
            <div key={faq.id}>
              <button
                type="button"
                onClick={() => handleToggle(faq.id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-stone-900 transition-colors hover:bg-stone-50 dark:text-white dark:hover:bg-zinc-800/50"
              >
                <span>{faq.question}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-stone-400 transition-transform duration-200 dark:text-zinc-500",
                    expandedId === faq.id && "rotate-180"
                  )}
                />
              </button>
              <AnimatePresence initial={false}>
                {expandedId === faq.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 text-sm leading-relaxed text-stone-600 dark:text-zinc-400">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
