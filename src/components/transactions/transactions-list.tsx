"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Collections } from "@/types/collections";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { formatISO, parseISO, format, startOfDay, endOfDay, startOfMonth } from "date-fns";
import { subDays } from "date-fns/subDays";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

type TxType = "expense" | "income" | "transfer" | "exchange";

type Account = { id: string; name: string };
type Currency = { id: string; name: string };
type Category = { id: string; name: string };
type Source = { id: string; name: string };

type Tx = any;

export function TransactionsList({
  type,
  accounts,
  currencies,
  categories,
  sources,
  onEdit,
}: {
  type: TxType;
  accounts: Account[];
  currencies: Currency[];
  categories?: Category[];
  sources?: Source[];
  onEdit?: (tx: Tx) => void;
}) {
  const { ownerUid } = useAuth();
  const [items, setItems] = useState<Tx[]>([]);
  const ALL = "__all__";
  const [accountFilter, setAccountFilter] = useState<string>(ALL);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  const accName = (id: string) => accounts.find((a) => a.id === id)?.name ?? id;
  const curName = (id: string) => currencies.find((c) => c.id === id)?.name ?? id;
  const catName = (id?: string) => categories?.find((c) => c.id === id)?.name ?? "";
  const srcName = (id?: string) => sources?.find((s) => s.id === id)?.name ?? "";

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
    if (accountFilter !== ALL) {
      arr = arr.filter(
        (it) => it.accountId === accountFilter || it.fromAccountId === accountFilter || it.toAccountId === accountFilter
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
      console.log('key', key);
      
      const arr = byDay.get(key) || [];
      arr.push(it);
      byDay.set(key, arr);
    }
    return Array.from(byDay.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  async function handleDelete(id: string) {
    await deleteDoc(doc(db, Collections.Transactions, id));
  }

  return (
    <div className="mt-6">
      <div className="mb-2 flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <label className="text-sm font-medium">Фильтр по счету</label>
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Все счета" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Все счета</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Период</label>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
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
                        <span className="font-medium">{accName(it.fromAccountId)} → {accName(it.toAccountId)}</span>
                        {it.comment ? <span className="text-muted-foreground"> — {it.comment}</span> : null}
                      </>
                    ) : (
                      <>
                        <span className="font-medium">{accName(it.accountId)}</span>
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
                    <Button variant="ghost" onClick={() => onEdit?.(it)}>Редактировать</Button>
                    <Button variant="destructive" onClick={() => handleDelete(it.id)}>Удалить</Button>
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

function DateRangePicker({
  value,
  onChange,
}: {
  value: { from?: Date; to?: Date };
  onChange: (v: { from?: Date; to?: Date }) => void;
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
        <Button variant="outline" className="min-w-56 justify-start">
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
              <Button onClick={() => { onChange(temp || {}); setOpen(false); }}>Готово</Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
