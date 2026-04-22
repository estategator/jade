"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ThemeMode } from "@/lib/settings";

const STORAGE_KEY = "curator_public_theme";

type PublicThemeContextValue = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggle: () => void;
};

const PublicThemeContext = createContext<PublicThemeContextValue>({
  theme: "light",
  setTheme: () => {},
  toggle: () => {},
});

export function usePublicTheme() {
  return useContext(PublicThemeContext);
}

function applyToDOM(theme: ThemeMode) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.setAttribute("data-theme", "dark");
    root.classList.add("dark");
  } else {
    root.setAttribute("data-theme", "light");
    root.classList.remove("dark");
  }
}

function readInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // ignore
  }
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function PublicThemeProvider({
  children,
  enabled,
}: Readonly<{ children: React.ReactNode; enabled: boolean }>) {
  const [theme, setThemeState] = useState<ThemeMode>("light");

  // Initialize from storage / system on mount
  useEffect(() => {
    if (!enabled) return;
    const initial = readInitialTheme();
    setThemeState(initial);
    applyToDOM(initial);
  }, [enabled]);

  // Listen for system preference changes (only if user hasn't explicitly chosen)
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      try {
        if (window.localStorage.getItem(STORAGE_KEY)) return; // user has a preference
      } catch {
        // ignore
      }
      const next: ThemeMode = mq.matches ? "dark" : "light";
      setThemeState(next);
      applyToDOM(next);
    };
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, [enabled]);

  const setTheme = useCallback(
    (next: ThemeMode) => {
      if (!enabled) return;
      setThemeState(next);
      applyToDOM(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
    },
    [enabled]
  );

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const value = useMemo<PublicThemeContextValue>(
    () => ({ theme, setTheme, toggle }),
    [theme, setTheme, toggle]
  );

  return (
    <PublicThemeContext.Provider value={value}>
      {children}
    </PublicThemeContext.Provider>
  );
}
