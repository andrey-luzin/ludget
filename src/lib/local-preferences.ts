import { ThemeMode } from "@/types/preferences";

const STORAGE_KEY = "ludget:preferences";

export type ThemePreference = {
  useSystemTheme: boolean;
  theme: ThemeMode;
};

export type PreferencesStore = {
  theme: ThemePreference;
};

const DEFAULT_PREFERENCES: PreferencesStore = {
  theme: {
    useSystemTheme: true,
    theme: ThemeMode.Light,
  },
};

function normalizeThemeMode(value: unknown): ThemeMode {
  return value === ThemeMode.Dark ? ThemeMode.Dark : ThemeMode.Light;
}

function normalizePreferences(raw: Partial<PreferencesStore> | null | undefined): PreferencesStore {
  if (!raw) return DEFAULT_PREFERENCES;
  return {
    theme: {
      useSystemTheme: raw.theme?.useSystemTheme ?? DEFAULT_PREFERENCES.theme.useSystemTheme,
      theme: normalizeThemeMode(raw.theme?.theme),
    },
  };
}

export function loadPreferences(): PreferencesStore {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<PreferencesStore> | null;
    return normalizePreferences(parsed);
  } catch (err) {
    console.warn("Failed to parse preferences", err);
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: PreferencesStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (err) {
    console.warn("Failed to write preferences", err);
  }
}

export function updatePreferences(partial: Partial<PreferencesStore>) {
  const current = loadPreferences();
  const next: PreferencesStore = {
    ...current,
    ...partial,
    theme: {
      useSystemTheme: partial.theme?.useSystemTheme ?? current.theme.useSystemTheme,
      theme: normalizeThemeMode(partial.theme?.theme ?? current.theme.theme),
    },
  };
  savePreferences(next);
  return next;
}
