export type ThemeMode = 'light' | 'dark' | 'system';
export type FontSize = 'sm' | 'base' | 'lg' | 'xl';

export type AppSettings = {
  theme: ThemeMode;
  fontSize: FontSize;
  brandPrimary: string | null;
  brandAccent: string | null;
  logoUrl: string | null;
};

export const SETTING_KEYS: (keyof AppSettings)[] = [
  'theme',
  'fontSize',
  'brandPrimary',
  'brandAccent',
  'logoUrl',
];

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  fontSize: 'base',
  brandPrimary: null,
  brandAccent: null,
  logoUrl: null,
};

export const FONT_SIZE_MAP: Record<FontSize, string> = {
  sm: '14px',
  base: '16px',
  lg: '18px',
  xl: '20px',
};

export const FONT_SIZE_LABELS: Record<FontSize, string> = {
  sm: 'Small',
  base: 'Default',
  lg: 'Large',
  xl: 'Extra Large',
};

export const BRAND_PRIMARY_PRESETS = [
  '#a78bfa', '#818cf8', '#6366f1', '#7c3aed',
  '#c084fc', '#e879f9', '#f472b6', '#fb7185',
  '#f87171', '#fb923c', '#fbbf24', '#a3e635',
  '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8',
] as const;

export const BRAND_ACCENT_PRESETS = [
  '#10b981', '#34d399', '#6ee7b7', '#a7f3d0',
  '#2dd4bf', '#5eead4', '#67e8f9', '#7dd3fc',
  '#93c5fd', '#a5b4fc', '#c4b5fd', '#d8b4fe',
  '#f0abfc', '#f9a8d4', '#fda4af', '#fcd34d',
] as const;

export type ResolvedSettings = {
  effective: AppSettings;
  lockedKeys: Set<keyof AppSettings>;
};

/**
 * Merges org settings, user settings, and enforcement into one effective config.
 * Priority: defaults → user overrides → org-enforced values (highest).
 */
export function resolveSettings(
  orgSettings: Partial<AppSettings> | null,
  enforcedKeys: string[],
  userOrgSettings: Partial<AppSettings> | null
): ResolvedSettings {
  const effective: AppSettings = { ...DEFAULT_SETTINGS };
  const lockedKeys = new Set<keyof AppSettings>();

  // Layer 1: Apply user preferences over defaults
  if (userOrgSettings) {
    for (const key of SETTING_KEYS) {
      const val = userOrgSettings[key];
      if (val !== null && val !== undefined) {
        (effective as Record<string, unknown>)[key] = val;
      }
    }
  }

  // Layer 2: Force org-enforced keys (overrides user prefs)
  if (orgSettings && enforcedKeys.length > 0) {
    for (const raw of enforcedKeys) {
      const key = raw as keyof AppSettings;
      if (SETTING_KEYS.includes(key) && orgSettings[key] !== null && orgSettings[key] !== undefined) {
        (effective as Record<string, unknown>)[key] = orgSettings[key];
        lockedKeys.add(key);
      }
    }
  }

  return { effective, lockedKeys };
}
