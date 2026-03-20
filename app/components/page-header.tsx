"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, LucideIcon } from "lucide-react";

type PageHeaderProps = {
  title: string;
  description?: string;
  backLink?: { href: string; label: string };
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
    variant?: "primary" | "secondary";
    icon?: LucideIcon;
  };
  actions?: Array<{
    label: string;
    href?: string;
    onClick?: () => void;
    variant?: "primary" | "secondary";
    icon?: LucideIcon;
  }>;
  className?: string;
};

export function PageHeader({
  title,
  description,
  backLink,
  action,
  actions = [],
  className = "",
}: PageHeaderProps) {
  // Support both single action and multiple actions
  const allActions = action ? [action, ...actions] : actions;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`mb-8 ${
        allActions.length > 0 ? "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" : ""
      } ${className}`}
    >
      <div>
        {backLink && (
          <Link
            href={backLink.href}
            className="mb-4 inline-flex items-center gap-1.5 rounded text-sm font-medium text-stone-500 transition-colors hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-zinc-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLink.label}
          </Link>
        )}
        <h1 className="text-3xl font-bold text-stone-900 dark:text-white sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-stone-600 dark:text-zinc-400">
            {description}
          </p>
        )}
      </div>

      {allActions.length > 0 && (
        <div className="w-full sm:w-auto">
          <div className="flex flex-wrap gap-3 sm:flex-row">
            {allActions.map((act, idx) => {
              const Icon = act.icon;
              const isPrimary = act.variant !== "secondary";
              const baseClasses =
                "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all";

              if (act.href) {
                return (
                  <Link
                    key={idx}
                    href={act.href}
                    className={`${baseClasses} ${
                      isPrimary
                        ? "border-transparent bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                        : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {Icon && <Icon className="h-4 w-4" />}
                    {act.label}
                  </Link>
                );
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={act.onClick}
                  className={`${baseClasses} ${
                    isPrimary
                      ? "border-transparent bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                      : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {act.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
