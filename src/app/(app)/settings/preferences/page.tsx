"use client";

import { Moon, Sun } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useThemePreferences } from "@/hooks/use-theme-preferences";
import { ThemeMode } from "@/types/preferences";
import { useI18n, type Language } from "@/contexts/i18n-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function PreferencesSettingsPage() {
  const { theme, useSystemTheme, setTheme, setUseSystemTheme } = useThemePreferences();
  const { lang, setLang, t } = useI18n();
  const [draftLang, setDraftLang] = useState<Language>(lang);
  const [saving, setSaving] = useState(false);

  async function handleSaveLanguage() {
    try {
      setSaving(true);
      // Persist via i18n setter (updates Firebase and localStorage)
      setLang(draftLang);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">{t("settings.personalization")}</h1>
      <p className="text-muted-foreground mt-1">{t("settings.theme.local_note")}</p>

      <div className="mt-6 space-y-6">
        <div className="rounded-lg border p-4">
          <div className="mb-2">
            <Label htmlFor="language-select">{t("settings.language")}</Label>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={draftLang} onValueChange={(v) => setDraftLang(v as Language)}>
              <SelectTrigger id="language-select" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ru">Русский</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" onClick={handleSaveLanguage} disabled={saving || draftLang === lang}>
              {t("common.save")}
            </Button>
          </div>
        </div>

        <div className="space-y-6 rounded-lg border p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="system-theme"
              checked={useSystemTheme}
              onCheckedChange={(checked) => setUseSystemTheme(Boolean(checked))}
            />
            <div className="space-y-1 inline-flex flex-col">
              <Label htmlFor="system-theme">{t("settings.theme.use_system")}</Label>
              <p className="text-sm text-muted-foreground">{t("settings.theme.use_system_hint")}</p>
            </div>
          </div>

          <div className={cn("flex items-center gap-3 rounded-md border p-4", useSystemTheme && "opacity-60")}>
            <div className="flex items-center gap-3">
              <Sun className="h-5 w-5" />
              <Switch
                id="theme-switcher"
                checked={theme === ThemeMode.Dark}
                disabled={useSystemTheme}
                onCheckedChange={(checked) => setTheme(checked ? ThemeMode.Dark : ThemeMode.Light)}
              />
              <Moon className="h-5 w-5" />
            </div>
            <Label htmlFor="theme-switcher" className="ml-3 text-sm text-muted-foreground">
              {theme === ThemeMode.Dark ? t("settings.theme.dark") : t("settings.theme.light")}
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
}
