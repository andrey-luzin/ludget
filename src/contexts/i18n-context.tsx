"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePreferences } from "@/hooks/use-preferences";
import { useAuth } from "@/contexts/auth-context";
import enDict from "@/i18n/en.json";
import ruDict from "@/i18n/ru.json";

export type Language = "en" | "ru";

type Messages = Record<string, string>;
type Dictionaries = Record<Language, Messages>;

const dictionaries: Dictionaries = { en: enDict as Record<string, string>, ru: ruDict as Record<string, string> };

function systemLanguage(): Language {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("ru")) return "ru";
  return "en"; // default if not ru/en
}

type I18nContextValue = {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { preferences, patchPreferences } = usePreferences();
  const { profile, profileLoading, updateProfile } = useAuth();

  const [lang, setLangState] = useState<Language>(() => {
    // init from localStorage preferences first, or system
    const local = preferences.language;
    return local === "ru" || local === "en" ? local : systemLanguage();
  });

  // When profile arrives with language, adopt it and persist
  useEffect(() => {
    if (profileLoading) return;
    const pLang = profile?.language;
    if (pLang === "en" || pLang === "ru") {
      if (pLang !== lang) {
        setLangState(pLang);
        patchPreferences({ language: pLang });
      } else if (preferences.language !== pLang) {
        patchPreferences({ language: pLang });
      }
    } else {
      // If profile has no language, ensure we have a valid local and default
      const resolved = (preferences.language === "en" || preferences.language === "ru")
        ? preferences.language!
        : systemLanguage();
      if (resolved !== lang) setLangState(resolved);
      if (preferences.language !== resolved) patchPreferences({ language: resolved });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoading, profile?.language]);

  const setLang = (next: Language) => {
    setLangState(next);
    patchPreferences({ language: next });
    // Save to Firebase profile as requested
    void updateProfile({ language: next });
  };

  const t = useMemo(() => {
    const dict = dictionaries[lang];
    return (key: string) => dict[key] ?? String(key);
  }, [lang]);

  const value = useMemo<I18nContextValue>(() => ({ lang, setLang, t }), [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
