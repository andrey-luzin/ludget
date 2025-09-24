"use client";

import { useCallback, useEffect } from "react";
import { usePreferences } from "@/hooks/use-preferences";
import { ThemeMode } from "@/types/preferences";

function getSystemTheme(): ThemeMode {
  if (typeof window === "undefined") return ThemeMode.Light;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? ThemeMode.Dark : ThemeMode.Light;
}

function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
}

export function useThemePreferences() {
  const { preferences, patchPreferences } = usePreferences();
  const { theme } = preferences;

  useEffect(() => {
    if (theme.useSystemTheme) {
      const current = getSystemTheme();
      patchPreferences({ theme: { useSystemTheme: true, theme: current } });
      applyTheme(current);
      if (typeof window === "undefined") return;
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (event: MediaQueryListEvent) => {
        const next = event.matches ? ThemeMode.Dark : ThemeMode.Light;
        patchPreferences({ theme: { useSystemTheme: true, theme: next } });
        applyTheme(next);
      };
      media.addEventListener("change", handler);
      return () => media.removeEventListener("change", handler);
    }
  }, [theme.useSystemTheme, patchPreferences]);

  useEffect(() => {
    if (!theme.useSystemTheme) {
      applyTheme(theme.theme);
    }
  }, [theme.theme, theme.useSystemTheme]);

  const setUseSystemTheme = useCallback(
    (value: boolean) => {
      if (value) {
        const systemTheme = getSystemTheme();
        patchPreferences({ theme: { useSystemTheme: true, theme: systemTheme } });
        applyTheme(systemTheme);
      } else {
        patchPreferences({ theme: { useSystemTheme: false, theme: theme.theme } });
      }
    },
    [patchPreferences, theme.theme]
  );

  const setTheme = useCallback(
    (nextTheme: ThemeMode.Light | ThemeMode.Dark) => {
      patchPreferences({ theme: { useSystemTheme: false, theme: nextTheme } });
      applyTheme(nextTheme);
    },
    [patchPreferences]
  );

  return {
    theme: theme.theme,
    useSystemTheme: theme.useSystemTheme,
    setUseSystemTheme,
    setTheme,
  };
}
