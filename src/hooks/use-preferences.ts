"use client";

import { useCallback, useEffect, useState } from "react";
import { loadPreferences, PreferencesStore, savePreferences, updatePreferences } from "@/lib/local-preferences";

export function usePreferences() {
  const [state, setState] = useState<PreferencesStore>(() => (typeof window === "undefined" ? loadPreferences() : loadPreferences()));

  useEffect(() => {
    setState(loadPreferences());
  }, []);

  const setPreferences = useCallback((next: PreferencesStore) => {
    setState(next);
    savePreferences(next);
  }, []);

  const patchPreferences = useCallback(
    (partial: Partial<PreferencesStore>) => {
      const next = updatePreferences(partial);
      setState(next);
    },
    []
  );

  return {
    preferences: state,
    setPreferences,
    patchPreferences,
  };
}
