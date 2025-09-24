"use client";

import { Moon, Sun } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useThemePreferences } from "@/hooks/use-theme-preferences";
import { ThemeMode } from "@/types/preferences";

export default function PreferencesSettingsPage() {
  const { theme, useSystemTheme, setTheme, setUseSystemTheme } = useThemePreferences();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Персонализация</h1>
      <p className="text-muted-foreground mt-1">
        Настройки темы сохраняются локально на этом устройстве и не синхронизируются между браузерами.
      </p>

      <div className="mt-6 space-y-6 rounded-lg border p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="system-theme"
            checked={useSystemTheme}
            onCheckedChange={(checked) => setUseSystemTheme(Boolean(checked))}
          />
          <div className="space-y-1 inline-flex flex-col">
            <Label htmlFor="system-theme">Использовать системную тему</Label>
            <p className="text-sm text-muted-foreground">
              Если включено, тема будет автоматически синхронизироваться с настройками операционной системы.
            </p>
          </div>
        </div>

        <div className={cn("flex items-center gap-3 rounded-md border p-4", useSystemTheme && "opacity-60")}
        >
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
            {theme === ThemeMode.Dark ? "Темная тема" : "Светлая тема"}
          </Label>
        </div>
      </div>
    </div>
  );
}
