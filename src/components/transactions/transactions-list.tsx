"use client";

import { useEffect, useMemo, useState, useId } from "react";
import { db } from "@/lib/firebase";
import { applyBalanceAdjustments } from "@/lib/account-balances";
import { useAuth } from "@/contexts/auth-context";
import { Collections } from "@/types/collections";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { formatISO, parseISO, format, startOfDay, endOfDay, startOfMonth } from "date-fns";
import { subDays } from "date-fns/subDays";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import type { Account, Category, Currency, Source } from "@/types/entities";

type TxType = "expense" | "income" | "transfer" | "exchange";

type Tx = any;

export function TransactionsList({
  type,
  accounts,
  currencies,
  categories,
  sources,
  onEdit,
  editingId,
}: {
  type: TxType;
  accounts: Account[];
  currencies: Currency[];
  categories?: Category[];
  sources?: Source[];
  onEdit?: (tx: Tx) => void;
  editingId?: string | null;
}) {
  const { ownerUid, userUid, showOnlyMyAccounts } = useAuth();
  const [items, setItems] = useState<Tx[]>([]);
  const [accountFilter, setAccountFilter] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const accFilterId = useId();
  const dateFilterId = useId();
  const hasFilters =
    accountFilter.length > 0 || Boolean(dateRange?.from || dateRange?.to);

  const resetFilters = () => {
    setAccountFilter([]);
    setDateRange({});
  };

  const accName = (id: string) => accounts.find((a) => a.id === id)?.name ?? id;
  const accColor = (id: string) => accounts.find((a) => a.id === id)?.color;
  const accIcon = (id: string) => accounts.find((a) => a.id === id)?.iconUrl;
  const curName = (id: string) => currencies.find((c) => c.id === id)?.name ?? id;
  const catName = (id?: string) => categories?.find((c) => c.id === id)?.name ?? "";
  const srcName = (id?: string) => sources?.find((s) => s.id === id)?.name ?? "";

  const accountOptions = useMemo(() => {
    if (!showOnlyMyAccounts || !userUid) return accounts;
    return accounts.filter((acc) => (acc.createdBy ?? ownerUid) === userUid);
  }, [accounts, showOnlyMyAccounts, userUid, ownerUid]);

  useEffect(() => {
    const allowedIds = new Set(accountOptions.map((a) => a.id));
    setAccountFilter((prev) => {
      const next = prev.filter((id) => allowedIds.has(id));
      if (next.length === prev.length && next.every((id, idx) => id === prev[idx])) {
        return prev;
      }
      return next;
    });
  }, [accountOptions]);

  useEffect(() => {
    if (!ownerUid) {
      return;
    }
    const q = query(
      collection(db, Collections.Transactions),
      where("ownerUid", "==", ownerUid),
      where("type", "==", type),
      orderBy("date", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    return () => unsub();
  }, [ownerUid, type]);

  const filtered = useMemo(() => {
    let arr = items;
    // Account filter
    if (accountFilter.length > 0) {
      const set = new Set(accountFilter);
      arr = arr.filter(
        (it) => set.has(it.accountId) || set.has(it.fromAccountId) || set.has(it.toAccountId)
      );
    }
    // Date range filter
    if (dateRange?.from || dateRange?.to) {
      const from = dateRange.from ? startOfDay(dateRange.from) : undefined;
      const to = dateRange.to ? endOfDay(dateRange.to) : undefined;
      arr = arr.filter((it) => {
        const d: Date = it.date?.toDate ? it.date.toDate() : new Date(it.date);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      });
    }
    return arr;
  }, [items, accountFilter, dateRange]);

  const grouped = useMemo(() => {
    const byDay = new Map<string, Tx[]>();
    for (const it of filtered) {
      const d: Date = it.date?.toDate ? it.date.toDate() : new Date(it.date);
      const key = formatISO(d, { representation: "date" });
      const arr = byDay.get(key) || [];
      arr.push(it);
      byDay.set(key, arr);
    }
    return Array.from(byDay.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  async function handleDelete(tx: Tx) {
    try {
      await deleteDoc(doc(db, Collections.Transactions, tx.id));
    } catch (err) {
      console.error("Failed to delete transaction", err);
      return;
    }

    if (!ownerUid) {
      return;
    }

    const adjustments: { accountId: string; currencyId: string; delta: number }[] = [];
    if (type === "income") {
      const amount = Math.abs(Number(tx.amount ?? 0));
      if (tx.accountId && tx.currencyId && amount) {
        adjustments.push({ accountId: tx.accountId, currencyId: tx.currencyId, delta: -amount });
      }
    } else if (type === "expense") {
      const amount = Math.abs(Number(tx.amount ?? 0));
      if (tx.accountId && tx.currencyId && amount) {
        adjustments.push({ accountId: tx.accountId, currencyId: tx.currencyId, delta: amount });
      }
    } else if (type === "transfer") {
      const amount = Math.abs(Number(tx.amount ?? 0));
      if (tx.fromAccountId && tx.currencyId && amount) {
        adjustments.push({ accountId: tx.fromAccountId, currencyId: tx.currencyId, delta: amount });
      }
      if (tx.toAccountId && tx.currencyId && amount) {
        adjustments.push({ accountId: tx.toAccountId, currencyId: tx.currencyId, delta: -amount });
      }
    } else if (type === "exchange") {
      const amountFrom = Math.abs(Number(tx.amountFrom ?? 0));
      const amountTo = Math.abs(Number(tx.amountTo ?? 0));
      if (tx.accountId && tx.fromCurrencyId && amountFrom) {
        adjustments.push({ accountId: tx.accountId, currencyId: tx.fromCurrencyId, delta: amountFrom });
      }
      if (tx.accountId && tx.toCurrencyId && amountTo) {
        adjustments.push({ accountId: tx.accountId, currencyId: tx.toCurrencyId, delta: -amountTo });
      }
    }
    if (adjustments.length) {
      try {
        await applyBalanceAdjustments(ownerUid, adjustments);
      } catch (err) {
        console.error("Failed to rollback balances after deletion", err);
      }
    }
  }

  return (
    <div className="mt-6 rounded-xl border bg-muted/30 p-4 md:p-5">
      <div className="mb-5 md:mb-6 flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <Label htmlFor={accFilterId}>Фильтр по счету</Label>
          <AccountsMultiSelect
            accounts={accountOptions}
            value={accountFilter}
            onChange={setAccountFilter}
            triggerId={accFilterId}
          />
        </div>

        <div className="grid gap-1">
          <Label htmlFor={dateFilterId}>Период</Label>
          <DateRangePicker value={dateRange} onChange={setDateRange} triggerId={dateFilterId} />
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto"
          disabled={!hasFilters}
          onClick={resetFilters}
        >
          Сбросить фильтры
        </Button>
      </div>

      <div className="grid gap-4">
        {grouped.map(([day, arr]) => (
          <div key={day} className="">
            <div className="text-sm text-muted-foreground mb-1">{format(parseISO(day), "dd.MM.yyyy")}</div>
            <div className="grid gap-2">
              {arr.map((it) => (
                <div key={it.id} className="flex items-center gap-3 border rounded-md p-2 pl-3.5">
                  <div className="flex-1 text-sm">
                    {type === "expense" ? (
                      <>
                        <span className="font-medium">{catName(it.categoryId)}</span>
                        {it.comment ? <span className="text-muted-foreground"> — {it.comment}</span> : null}
                      </>
                    ) : type === "income" ? (
                      <>
                        <span className="font-medium">{srcName(it.sourceId)}</span>
                        {it.comment ? <span className="text-muted-foreground"> — {it.comment}</span> : null}
                      </>
                    ) : type === "transfer" ? (
                      <>
                        {accIcon(it.fromAccountId) ? (
                          <img src={accIcon(it.fromAccountId)!} alt="" className="inline-block h-4 w-4 mr-1 align-[-2px] object-contain" />
                        ) : null}
                        <span className="font-medium" style={{ color: accColor(it.fromAccountId) || undefined }}>{accName(it.fromAccountId)}</span>
                        <span className="mx-1.5">→</span>
                        {accIcon(it.toAccountId) ? (
                          <img src={accIcon(it.toAccountId)!} alt="" className="inline-block h-4 w-4 mr-1 align-[-2px] object-contain" />
                        ) : null}
                        <span className="font-medium" style={{ color: accColor(it.toAccountId) || undefined }}>{accName(it.toAccountId)}</span>
                        {it.comment ? <span className="text-muted-foreground"> — {it.comment}</span> : null}
                      </>
                    ) : (
                      <>
                        {accIcon(it.accountId) ? (
                          <img src={accIcon(it.accountId)!} alt="" className="inline-block h-4 w-4 mr-1 align-[-2px] object-contain" />
                        ) : null}
                        <span className="font-medium" style={{ color: accColor(it.accountId) || undefined }}>{accName(it.accountId)}</span>
                        {it.comment ? <span className="text-muted-foreground"> — {it.comment}</span> : null}
                      </>
                    )}
                  </div>
                  <div className="text-sm">
                    {type === "exchange" ? (
                      <>
                        <span className="text-red-600 mr-2">-{it.amountFrom} {curName(it.fromCurrencyId)}</span>
                        <span className="text-green-600">+{it.amountTo} {curName(it.toCurrencyId)}</span>
                      </>
                    ) : (
                      <>
                        <span className={Number(it.amount) >= 0 ? "text-foreground" : "text-red-600"}>{it.amount}</span>
                        {it.currencyId ? <span className="text-muted-foreground ml-1">{curName(it.currencyId)}</span> : null}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => onEdit?.(it)}
                      disabled={editingId === it.id}
                    >
                      Редактировать
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleDelete(it)}
                      disabled={editingId === it.id}
                    >
                      Удалить
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountsMultiSelect({
  accounts,
  value,
  onChange,
  triggerId,
}: {
  accounts: Account[];
  value: string[];
  onChange: (v: string[]) => void;
  triggerId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<string[]>(value || []);

  // Sync temp when opening the popover
  useEffect(() => {
    if (open) setTemp(value || []);
  }, [open]);

  const label = useMemo(() => {
    if (!value?.length) return "Все счета";
    if (value.length === 1) return accounts.find((a) => a.id === value[0])?.name ?? "1 счёт";
    return `Счета: ${value.length}`;
  }, [value, accounts]);

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
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => toggle(a.id, Boolean(v))}
                  />
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

function DateRangePicker({
  value,
  onChange,
  triggerId,
}: {
  value: { from?: Date; to?: Date };
  onChange: (v: { from?: Date; to?: Date }) => void;
  triggerId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<{ from?: Date; to?: Date }>(value || {});

  // Initialize temp when opening
  useEffect(() => {
    if (open) setTemp(value || {});
  }, [open]);

  const label = useMemo(() => {
    const { from, to } = value || {};
    if (from && to) {
      const sameDay = startOfDay(from).getTime() === startOfDay(to).getTime();
      if (sameDay) return format(from, "dd.MM.yyyy");
      return `${format(from, "dd.MM.yyyy")} — ${format(to, "dd.MM.yyyy")}`;
    }
    if (from && !to) return `${format(from, "dd.MM.yyyy")} — …`;
    if (!from && to) return `… — ${format(to, "dd.MM.yyyy")}`;
    return "Все даты";
  }, [value]);

  function setPreset(preset: "day" | "weekSliding" | "monthSliding" | "yearSliding" | "sinceMonthStart") {
    const now = new Date();
    if (preset === "day") {
      const d = new Date();
      setTemp({ from: d, to: d });
    } else if (preset === "weekSliding") {
      setTemp({ from: startOfDay(subDays(now, 6)), to: now });
    } else if (preset === "monthSliding") {
      setTemp({ from: startOfDay(subDays(now, 29)), to: now });
    } else if (preset === "yearSliding") {
      setTemp({ from: startOfDay(subDays(now, 364)), to: now });
    } else if (preset === "sinceMonthStart") {
      setTemp({ from: startOfMonth(now), to: now });
    }
  }

  function clear() {
    setTemp({});
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={triggerId} variant="outline" className="min-w-56 justify-start">
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-3">
        <div className="flex flex-col md:flex-row gap-3">
          <Calendar
            mode="range"
            selected={{ from: temp.from, to: temp.to }}
            onSelect={(range: any) => setTemp(range || {})}
            numberOfMonths={2}
            defaultMonth={temp.from ?? value.from ?? new Date()}
            className="rounded-md"
          />
          <div className="w-48 md:w-56 grid gap-2">
            <div className="text-sm font-medium">Быстрый выбор</div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setPreset("day")}>За день</Button>
              <Button variant="secondary" onClick={() => setPreset("weekSliding")}>За неделю</Button>
              <Button variant="secondary" onClick={() => setPreset("monthSliding")}>За месяц</Button>
              <Button variant="secondary" onClick={() => setPreset("yearSliding")}>За год</Button>
              <Button variant="secondary" onClick={() => setPreset("sinceMonthStart")} className="col-span-2">С начала месяца</Button>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button variant="ghost" onClick={clear}>Сбросить</Button>
              <Button onClick={() => { onChange(temp || {}); setOpen(false); }}>Применить</Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
