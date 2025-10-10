"use client";

import { useEffect, useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Account } from "@/types/entities";

export function AccountsMultiSelect({
  accounts,
  value,
  onChange,
  triggerId,
  placeholder = "Все счета",
}: {
  accounts: Account[];
  value: string[];
  onChange: (v: string[]) => void;
  triggerId?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<string[]>(value || []);

  useEffect(() => {
    if (open) setTemp(value || []);
  }, [open]);

  const label = useMemo(() => {
    if (!value?.length) return placeholder;
    if (value.length === 1) return accounts.find((a) => a.id === value[0])?.name ?? "1 счёт";
    return `Счета: ${value.length}`;
  }, [value, accounts, placeholder]);

  function toggle(id: string, checked: boolean) {
    const set = new Set(temp);
    if (checked) set.add(id);
    else set.delete(id);
    setTemp(Array.from(set));
  }

  function clear() {
    setTemp([]);
  }

  function selectAllToggle() {
    const allIds = accounts.map((a) => a.id);
    const isAllSelected = temp.length === allIds.length && allIds.length > 0;
    setTemp(isAllSelected ? [] : allIds);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={triggerId} variant="outline" className="min-w-56 justify-start">
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-3 w-64">
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={clear}>Сбросить</Button>
            <Button variant="secondary" size="sm" onClick={selectAllToggle}>
              {temp.length === accounts.length && accounts.length > 0 ? "Сбросить все" : "Выбрать все"}
            </Button>
          </div>
          <div className="max-h-56 overflow-auto rounded-md border p-2">
            {accounts.map((a) => {
              const checked = temp.includes(a.id);
              return (
                <label key={a.id} className="flex items-center gap-2 py-1 cursor-pointer select-none">
                  <Checkbox checked={checked} onCheckedChange={(v) => toggle(a.id, Boolean(v))} />
                  {a.iconUrl ? (
                    <img src={a.iconUrl} alt="" className="h-4 w-4 object-contain" />
                  ) : null}
                  <span className="text-sm font-semibold" style={{ color: a.color || undefined }}>{a.name}</span>
                </label>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { onChange(temp); setOpen(false); }}>Применить</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

