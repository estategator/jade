"use client";

import { useEffect, useState } from "react";
import { PiMoonDuotone, PiSunDuotone } from "react-icons/pi";
import { usePublicTheme } from "@/app/components/public-theme-provider";

export function PublicThemeToggle() {
  const { theme, toggle } = usePublicTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        aria-hidden="true"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-300 opacity-50 dark:text-zinc-600"
      >
        <PiSunDuotone className="h-4 w-4" />
      </button>
    );
  }

  const Icon = theme === "dark" ? PiMoonDuotone : PiSunDuotone;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Theme: ${theme}`}
      title={`Theme: ${theme}`}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
