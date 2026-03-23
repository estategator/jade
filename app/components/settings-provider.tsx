"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AppSettings, ResolvedSettings } from "@/lib/settings";
import {
  DEFAULT_SETTINGS,
  FONT_SIZE_MAP,
  resolveSettings,
} from "@/lib/settings";
import { getActiveOrgId, setActiveOrgId, clearActiveOrgId } from "@/lib/active-org";
import {
  getOrgSettings,
  getUserOrgSettings,
  updateUserOrgSettings,
} from "@/app/settings/actions";

type SettingsContextValue = {
  settings: AppSettings;
  lockedKeys: Set<keyof AppSettings>;
  activeOrgId: string | null;
  userId: string | null;
  loading: boolean;
  setActiveOrg: (orgId: string | null) => void;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  refresh: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  lockedKeys: new Set(),
  activeOrgId: null,
  userId: null,
  loading: true,
  setActiveOrg: () => {},
  updateSetting: () => {},
  refresh: () => Promise.resolve(),
});

export function useSettings() {
  return useContext(SettingsContext);
}

function applyThemeToDOM(theme: AppSettings["theme"]) {
  const root = document.documentElement;
  
  if (theme === "dark") {
    root.setAttribute("data-theme", "dark");
    root.classList.add("dark");
  } else {
    root.setAttribute("data-theme", "light");
    root.classList.remove("dark");
  }
}

function applyCSSVars(settings: AppSettings) {
  const root = document.documentElement;
  root.style.setProperty("--app-font-size", FONT_SIZE_MAP[settings.fontSize]);
  if (settings.brandPrimary) {
    root.style.setProperty("--brand-primary", settings.brandPrimary);
  } else {
    root.style.removeProperty("--brand-primary");
  }
  if (settings.brandAccent) {
    root.style.setProperty("--brand-accent", settings.brandAccent);
  } else {
    root.style.removeProperty("--brand-accent");
  }
}

function getCachedSettings(orgId: string | null): Partial<AppSettings> | null {
  try {
    const cacheKey = 'curator_settings_' + (orgId || 'default');
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      return JSON.parse(cached) as Partial<AppSettings>;
    }
  } catch (e) {
    // Silently ignore cache read errors
  }
  return null;
}

function setCachedSettings(orgId: string | null, settings: Partial<AppSettings>) {
  try {
    const cacheKey = 'curator_settings_' + (orgId || 'default');
    localStorage.setItem(cacheKey, JSON.stringify(settings));
  } catch (e) {
    // Silently ignore cache write errors (quota exceeded, etc.)
  }
}

export function SettingsProvider({
  children,
  userId,
}: Readonly<{ children: React.ReactNode; userId: string | null }>) {
  const router = useRouter();
  const [resolved, setResolved] = useState<ResolvedSettings>({
    effective: DEFAULT_SETTINGS,
    lockedKeys: new Set(),
  });
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(() => getActiveOrgId());
  const [loading, setLoading] = useState(true);

  // Track raw pieces for merging on local changes
  const [orgSettings, setOrgSettings] = useState<Partial<AppSettings> | null>(null);
  const [enforcedKeys, setEnforcedKeys] = useState<string[]>([]);
  const [userSettings, setUserSettings] = useState<Partial<AppSettings> | null>(null);

  const loadSettings = useCallback(
    async (orgId: string | null) => {
      if (!userId || !orgId) {
        const res = resolveSettings(null, [], null);
        setOrgSettings(null);
        setEnforcedKeys([]);
        setUserSettings(null);
        setResolved(res);
        setLoading(false);
        return;
      }

      const [orgRes, userRes] = await Promise.all([
        getOrgSettings(orgId),
        getUserOrgSettings(userId, orgId),
      ]);

      const os = orgRes.data?.settings ?? null;
      const ek = orgRes.data?.enforced_keys ?? [];
      const us = userRes.data?.settings ?? null;

      setOrgSettings(os);
      setEnforcedKeys(ek);
      setUserSettings(us);
      setResolved(resolveSettings(os, ek, us));
      setLoading(false);
    },
    [userId]
  );

  // Init: load settings for the active org
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!userId || !activeOrgId) {
        if (!cancelled) {
          setOrgSettings(null);
          setEnforcedKeys([]);
          setUserSettings(null);
          setResolved(resolveSettings(null, [], null));
          setLoading(false);
        }
        return;
      }

      // 1. Apply cached settings immediately (fast path for first paint)
      const cached = getCachedSettings(activeOrgId);
      if (cached && !cancelled) {
        const initialResolved = resolveSettings(cached, [], null);
        setResolved(initialResolved);
        applyThemeToDOM(initialResolved.effective.theme);
        applyCSSVars(initialResolved.effective);
      }

      // 2. Fetch from server as source of truth
      const [orgRes, userRes] = await Promise.all([
        getOrgSettings(activeOrgId),
        getUserOrgSettings(userId, activeOrgId),
      ]);

      if (cancelled) return;

      const os = orgRes.data?.settings ?? null;
      const ek = orgRes.data?.enforced_keys ?? [];
      const us = userRes.data?.settings ?? null;

      setOrgSettings(os);
      setEnforcedKeys(ek);
      setUserSettings(us);
      const serverResolved = resolveSettings(os, ek, us);
      setResolved(serverResolved);

      // 3. Update cache with effective settings from server for next load
      setCachedSettings(activeOrgId, {
        theme: serverResolved.effective.theme,
        fontSize: serverResolved.effective.fontSize,
        brandPrimary: serverResolved.effective.brandPrimary,
        brandAccent: serverResolved.effective.brandAccent,
        logoUrl: serverResolved.effective.logoUrl,
      });

      setLoading(false);
    }

    init();
    return () => { cancelled = true; };
  }, [userId, activeOrgId]);

  // Apply settings to DOM whenever they change
  useEffect(() => {
    applyThemeToDOM(resolved.effective.theme);
    applyCSSVars(resolved.effective);
  }, [resolved.effective]);

  const setActiveOrg = useCallback(
    (orgId: string | null) => {
      if (!orgId) return; // Cannot clear active org — personal workspace removed
      setActiveOrgId(orgId);
      setActiveOrgIdState(orgId);
      setLoading(true);
      loadSettings(orgId).then(() => router.refresh());
    },
    [loadSettings, router]
  );

  const updateSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      if (resolved.lockedKeys.has(key)) return;

      const updated = { ...userSettings, [key]: value } as Partial<AppSettings>;
      setUserSettings(updated);

      const newResolved = resolveSettings(orgSettings, enforcedKeys, updated);
      setResolved(newResolved);

      // Persist to cache and server
      if (userId && activeOrgId) {
        setCachedSettings(activeOrgId, {
          theme: newResolved.effective.theme,
          fontSize: newResolved.effective.fontSize,
          brandPrimary: newResolved.effective.brandPrimary,
          brandAccent: newResolved.effective.brandAccent,
          logoUrl: newResolved.effective.logoUrl,
        });
        updateUserOrgSettings(userId, activeOrgId, updated).catch((err) =>
          console.error('Failed to persist user settings:', err)
        );
      }
    },
    [resolved.lockedKeys, userSettings, orgSettings, enforcedKeys, userId, activeOrgId]
  );

  const refresh = useCallback((): Promise<void> => {
    return loadSettings(activeOrgId);
  }, [activeOrgId, loadSettings]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings: resolved.effective,
      lockedKeys: resolved.lockedKeys,
      activeOrgId,
      userId,
      loading,
      setActiveOrg,
      updateSetting,
      refresh,
    }),
    [resolved, activeOrgId, userId, loading, setActiveOrg, updateSetting, refresh]
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}
