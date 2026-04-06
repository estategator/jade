"use client";

import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";

type DrawerSide = "right" | "left";

type DrawerProps = Readonly<{
  open: boolean;
  side?: DrawerSide;
  className?: string;
  children: ReactNode;
}>;

export function Drawer({
  open,
  side = "right",
  className,
  children,
}: DrawerProps) {
  if (typeof document === "undefined") return null;

  const isRight = side === "right";

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-70 bg-black/40 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: isRight ? "100%" : "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: isRight ? "100%" : "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn(
              "fixed inset-y-0 z-70 flex w-full max-w-md flex-col border-stone-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900",
              isRight ? "right-0 border-l" : "left-0 border-r",
              className,
            )}
          >
            {children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
