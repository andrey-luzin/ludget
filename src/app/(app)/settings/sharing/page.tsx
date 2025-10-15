"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/contexts/i18n-context";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function SharingSettingsPage() {
  const { showOnlyMyAccounts, updateProfile, profileLoading } = useAuth();
  const { t } = useI18n();
  const [value, setValue] = useState(showOnlyMyAccounts);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValue(showOnlyMyAccounts);
  }, [showOnlyMyAccounts]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await updateProfile({ showOnlyMyAccounts: value });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">{t("settings.sharing.title")}</h1>
      <p className="text-muted-foreground mt-1">{t("settings.sharing.description")}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="flex items-start gap-3 rounded-md border p-4">
          <Checkbox
            id="show-own-accounts"
            checked={value}
            disabled={profileLoading || saving}
            onCheckedChange={(checked) => setValue(Boolean(checked))}
          />
          <div className="space-y-1 inline-flex flex-col">
            <Label htmlFor="show-own-accounts">{t("settings.sharing.only_mine")}</Label>
            <p className="text-sm text-muted-foreground max-w-lg">
              {t("settings.sharing.only_mine_hint")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={profileLoading || saving} loading={saving}>{t("common.save")}</Button>
          {saved ? <span className="text-sm text-muted-foreground">OK</span> : null}
        </div>
      </form>
    </div>
  );
}
