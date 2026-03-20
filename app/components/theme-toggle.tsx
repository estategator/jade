"use client";

import { useState, useEffect } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useSettings } from "@/app/components/settings-provider";
import type { ThemeMode } from "@/lib/settings";

const CYCLE: ThemeMode[] = ["light", "dark", "system"];

const ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

export function ThemeToggle() {
  const { settings, lockedKeys, updateSetting, activeOrgId } = useSettings();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLocked = lockedKeys.has("theme");
  const disabled = isLocked || !activeOrgId;

  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-300 opacity-50 dark:text-zinc-600"
      >
        <Sun className="h-4 w-4" />
      </button>
    );
  }

  const Icon = ICONS[settings.theme];

  function handleClick() {
    if (disabled) return;
    const idx = CYCLE.indexOf(settings.theme);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    updateSetting("theme", next);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={`Theme: ${settings.theme}`}
      title={
        isLocked
          ? "Theme is set by your organization"
          : !activeOrgId
            ? "Select an organization to customize theme"
            : `Theme: ${settings.theme}`
      }
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
