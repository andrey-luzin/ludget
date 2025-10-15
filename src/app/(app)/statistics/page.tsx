"use client";

import { useEffect, useMemo, useState } from "react";
import { DateRangePicker, type DateRange } from "@/components/filters/date-range-picker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { UserStatus } from "@/types/user-profile";
import { db } from "@/lib/firebase";
import { Collections } from "@/types/collections";
import type { Account, Category, Currency } from "@/types/entities";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { CategoryMultiSelect } from "@/components/statistics/category-multiselect";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { getRatesWithCache, convertToBaseFactor } from "@/lib/exchange";
import { buildCategoryIndex, getDescendants } from "@/lib/categories";
import { useChartPalette } from "@/hooks/use-chart-palette";
import { CategoryListWithPopover } from "@/components/statistics/category-list";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { roundMoneyAmount } from "@/lib/money";
import { AccountsMultiSelect } from "@/components/filters/accounts-multi-select";

type Tx = { id: string; amount: number; date: any; categoryId?: string | null };

export default function StatisticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29), to: now };
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [tab, setTab] = useState("categories");

  const { ownerUid, profile } = useAuth();
  const isPremium = (profile?.status || UserStatus.Default) === UserStatus.Premium;
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Tx[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountFilter, setAccountFilter] = useState<string[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [targetCurrencyId, setTargetCurrencyId] = useState<string>("");
  const targetCurrency = useMemo(() => currencies.find((c) => c.id === targetCurrencyId) || null, [currencies, targetCurrencyId]);
  const targetCode = targetCurrency?.code || null;
  const [rates, setRates] = useState<Record<string, number>>({});
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!ownerUid) return;
    const q = query(collection(db, Collections.Categories), where("ownerUid", "==", ownerUid), orderBy("name"));
    const unsub = onSnapshot(q, (snap) => {
      setCategories(
        snap.docs.map((d) => {
          const x = d.data() as any;
          return { id: d.id, name: x.name, parentId: x.parentId ?? null, order: typeof x.order === "number" ? x.order : undefined } as Category;
        })
      );
    });
    return () => unsub();
  }, [ownerUid]);

  useEffect(() => {
    if (!ownerUid) return;
    const q = query(
      collection(db, Collections.Transactions),
      where("ownerUid", "==", ownerUid),
      where("type", "==", "expense"),
      orderBy("date", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Tx[]);
    });
    return () => unsub();
  }, [ownerUid]);

  useEffect(() => {
    if (!ownerUid) return;
    const q = query(collection(db, Collections.Accounts), where("ownerUid", "==", ownerUid), orderBy("name"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => {
        const x = d.data() as any;
        return { id: d.id, name: x.name, color: x.color, iconUrl: x.iconUrl, createdBy: x.createdBy, order: typeof x.order === "number" ? x.order : undefined } as Account;
      });
      setAccounts(list);
    });
    return () => unsub();
  }, [ownerUid]);

  useEffect(() => {
    if (!ownerUid) return;
    const q = query(collection(db, Collections.Currencies), where("ownerUid", "==", ownerUid), orderBy("name"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => {
        const x = d.data() as any;
        return { id: d.id, name: x.name, code: x.code || undefined, order: typeof x.order === "number" ? x.order : undefined } as Currency;
      });
      setCurrencies(list);
      setTargetCurrencyId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        // Pick first currency with code or fallback to RUB if exists
        const withCode = list.find((c) => c.code);
        return withCode?.id || list.find((c) => c.name.toUpperCase().includes("RUB"))?.id || list[0]?.id || "";
      });
    });
    return () => unsub();
  }, [ownerUid]);

  const [ratesLoading, setRatesLoading] = useState(false);

  async function refreshRates(force = false) {
    setRatesError(null);
    setRatesLoading(true);
    try {
      if (!isPremium) {
        // Do not hit currency API for non-premium users
        setRatesError("Доступ к курсам валют ограничен. Доступно только для Premium-пользователей.");
        return;
      }
      const neededCodes = currencies.map((c) => c.code).filter(Boolean) as string[];
      if (targetCode) {
        const res = await getRatesWithCache(targetCode, { force, neededCodes });
        setRates(res.rates);
        setRatesUpdatedAt(res.updatedAt);
        if (res.error) {
          setRatesError("Не удалось обновить курсы. Показаны кэшированные значения.");
        }
      }
    } catch (e: any) {
      setRatesError(e?.message || "Не удалось загрузить курс валют.");
    } finally {
      setRatesLoading(false);
    }
  }

  useEffect(() => {
    async function load() {
      await refreshRates(false);
    }
    if (targetCode) {
      load();
    }
  }, [targetCode, isPremium]);

  const from = useMemo(() => dateRange.from ?? new Date(0), [dateRange]);
  const to = useMemo(() => dateRange.to ?? new Date(), [dateRange]);

  const catIndex = useMemo(() => buildCategoryIndex(categories), [categories]);

  const activeCatSet = useMemo(() => {
    if (selectedCategories.length === 0) return null; // null means all
    const set = new Set<string>();
    for (const id of selectedCategories) {
      set.add(id);
      for (const d of getDescendants(id, catIndex.childrenOf)) set.add(d);
    }
    return set;
  }, [selectedCategories, catIndex]);

  const filtered = useMemo(() => {
    const arr = items.filter((it) => {
      const d: Date = it.date?.toDate ? it.date.toDate() : new Date(it.date);
      if (d < from || d > to) return false;
      if (accountFilter.length) {
        const set = new Set(accountFilter);
        if (!set.has((it as any).accountId)) return false;
      }
      if (!activeCatSet) return true;
      const catId = it.categoryId ?? "";
      return activeCatSet.has(catId);
    });
    return arr;
  }, [items, from, to, activeCatSet, accountFilter]);

  const codeByCurrencyId = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of currencies) if (c.code) m.set(c.id, c.code);
    return m;
  }, [currencies]);

  const grouped = useMemo(() => {
    const byId = new Map<string, number>();
    for (const it of filtered) {
      const id = it.categoryId ?? "__uncat__";
      const txCurCode = codeByCurrencyId.get((it as any).currencyId) || targetCode;
      if (txCurCode && targetCode) {
        const factor = convertToBaseFactor(txCurCode, rates, targetCode);
        const converted = Number(it.amount || 0) * factor;
        const rounded = Math.round(converted * 100) / 100;
        byId.set(id, (byId.get(id) || 0) + rounded);
      }
    }
    const data = Array.from(byId.entries()).map(([id, value]) => ({ id, name: catIndex.byId.get(id)?.name ?? "Без категории", value }));
    data.sort((a, b) => b.value - a.value);
    return data;
  }, [filtered, catIndex, rates, codeByCurrencyId, targetCode]);

  const total = grouped.reduce((s, x) => s + x.value, 0);
  const palette = useChartPalette();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Статистика</h1>
      {!isPremium ? (
        <div className="rounded-md border border-yellow-300/50 bg-yellow-50 p-3 text-sm flex items-start justify-between gap-3">
          <div>
            <div className="font-medium">Ограничение тарифного плана</div>
            <div className="text-muted-foreground">Курсы валют доступны только для Premium-пользователей. Данные отображаются без конвертации.</div>
          </div>
        </div>
      ) : null}
      {ratesError && isPremium ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm flex items-start justify-between gap-3">
          <div>
            <div className="font-medium">Проблема с курсами валют</div>
            <div className="text-muted-foreground">
              {ratesError}
              {ratesUpdatedAt ? ` (обновлено: ${new Date(ratesUpdatedAt).toLocaleDateString()})` : null}
            </div>
          </div>
          <button className="text-xs text-muted-foreground cursor-pointer" onClick={() => setRatesError(null)}>Скрыть</button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Период</div>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
        <div className="space-y-2 min-w-64">
          <div className="text-sm text-muted-foreground">Категории</div>
          <CategoryMultiSelect value={selectedCategories} onChange={setSelectedCategories} categories={categories} />
        </div>
        <div className="space-y-2 min-w-64">
          <div className="text-sm text-muted-foreground">Счета</div>
          <AccountsMultiSelect accounts={accounts} value={accountFilter} onChange={setAccountFilter} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" onClick={() => resetFilters(setDateRange, setSelectedCategories)}>
            Сбросить
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card text-card-foreground">
        <div className="p-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Итого расходов</div>
            <div className="text-2xl font-semibold">{`${roundMoneyAmount(total)} ${targetCode}`}</div>
          </div>
        </div>
        <div className="px-2 pb-4">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <div className="flex items-center justify-between px-2">
              <TabsList>
                <TabsTrigger value="categories">Категории</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Валюта</span>
                <Select value={targetCurrencyId} onValueChange={setTargetCurrencyId}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Валюта" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.id} value={c.id} disabled={!c.code}>
                        {c.name} {c.code ? `(${c.code})` : "(без кода)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => refreshRates(true)} loading={ratesLoading} disabled={ratesLoading || !isPremium} title={!isPremium ? "Доступно только для Premium" : undefined}>Обновить курсы сейчас</Button>
              </div>
            </div>
            <TabsContent value="categories" className="mt-2 p-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="h-[320px] sm:h-[520px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={grouped} dataKey="value" nameKey="name" innerRadius={60} stroke="hsl(var(--card))" strokeWidth={1}>
                        {grouped.map((entry, index) => (
                          <Cell key={`cell-${entry.id}`} fill={palette[index % palette.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => `${roundMoneyAmount(Number(v))} ${targetCode}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <CategoryListWithPopover
                  data={grouped}
                  palette={palette}
                  items={filtered}
                  catIndex={catIndex}
                  codeByCurrencyId={codeByCurrencyId}
                  targetCode={targetCode || undefined}
                  accounts={accounts}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function resetFilters(setDateRange: (r: DateRange) => void, setCategories: (v: string[]) => void) {
  const now = new Date();
  setDateRange({ from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29), to: now });
  setCategories([]);
}

// helpers moved to lib/components
