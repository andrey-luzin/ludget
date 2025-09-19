"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function SharingSettingsPage() {
  const { showOnlyMyAccounts, updateProfile, profileLoading } = useAuth();
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
      <h1 className="text-2xl font-semibold tracking-tight">Совместное использование</h1>
      <p className="text-muted-foreground mt-1">
        Добавляйте коллег и управляйте тем, какие счета видны по умолчанию в формах.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="flex items-start gap-3 rounded-md border p-4">
          <Checkbox
            id="show-own-accounts"
            checked={value}
            disabled={profileLoading || saving}
            onCheckedChange={(checked) => setValue(Boolean(checked))}
          />
          <div className="space-y-1">
            <Label htmlFor="show-own-accounts">Показывать только мои счета</Label>
            <p className="text-sm text-muted-foreground max-w-lg">
              Когда включено, в выпадающих списках будет показан только список счетов, созданных вами.
              Транзакции и статистика при этом остаются общими для всех участников.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={profileLoading || saving} loading={saving}>
            Сохранить
          </Button>
          {saved ? <span className="text-sm text-muted-foreground">Сохранено</span> : null}
        </div>
      </form>
    </div>
  );
}
