"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

type CheckoutMessageProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  backLink: { label: string; href: string };
  iconColor?: string;
};

export function CheckoutMessage({
  icon: Icon,
  title,
  description,
  backLink,
  iconColor = "text-emerald-500",
}: CheckoutMessageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
      >
        <Icon className={`mx-auto h-16 w-16 ${iconColor}`} />
      </motion.div>
      <h1 className="mt-6 text-3xl font-bold text-stone-900 dark:text-white">
        {title}
      </h1>
      <p className="mt-2 text-sm text-stone-600 dark:text-zinc-400">
        {description}
      </p>
      <Link
        href={backLink.href}
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-indigo-700"
      >
        {backLink.label}
      </Link>
    </motion.div>
  );
}
