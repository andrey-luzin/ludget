"use client";

import { useThemePreferences } from "@/hooks/use-theme-preferences";

type ThemeProviderProps = {
  children: React.ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  useThemePreferences();
  return <>{children}</>;
}
