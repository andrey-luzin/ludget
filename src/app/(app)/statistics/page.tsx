"use client";

import { useEffect, useMemo, useState } from "react";
import { DateRangePicker, type DateRange } from "@/components/filters/date-range-picker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { Collections } from "@/types/collections";
import type { Category, Currency } from "@/types/entities";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { CategoryMultiSelect } from "@/components/statistics/category-multiselect";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { getRatesWithCache } from "@/lib/exchange";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { roundMoneyAmount } from "@/lib/money";

type Tx = { id: string; amount: number; date: any; categoryId?: string | null };

export default function StatisticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29), to: now };
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [tab, setTab] = useState("categories");

  const { ownerUid } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Tx[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [targetCurrencyId, setTargetCurrencyId] = useState<string>("");
  const targetCurrency = useMemo(() => currencies.find((c) => c.id === targetCurrencyId) || null, [currencies, targetCurrencyId]);
  const targetCode = targetCurrency?.code || "RUB";
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
      const neededCodes = currencies.map((c) => c.code).filter(Boolean) as string[];
      const res = await getRatesWithCache(targetCode, { force, neededCodes });
      setRates(res.rates);
      setRatesUpdatedAt(res.updatedAt);
      if (res.error) {
        setRatesError("Не удалось обновить курсы. Показаны кэшированные значения.");
      }
    } catch (e: any) {
      setRatesError(e?.message || "Не удалось загрузить курс валют.");
    } finally {
      setRatesLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      await refreshRates(false);
    }
    if (targetCode) load();
    return () => {
      cancelled = true;
    };
  }, [targetCode]);

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
      if (!activeCatSet) return true;
      const catId = it.categoryId ?? "";
      return activeCatSet.has(catId);
    });
    return arr;
  }, [items, from, to, activeCatSet]);

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
      const factor = convertToBaseFactor(txCurCode, rates, targetCode);
      const converted = Number(it.amount || 0) * factor;
      const rounded = Math.round(converted * 100) / 100;
      byId.set(id, (byId.get(id) || 0) + rounded);
    }
    const data = Array.from(byId.entries()).map(([id, value]) => ({ id, name: catIndex.byId.get(id)?.name ?? "Без категории", value }));
    data.sort((a, b) => b.value - a.value);
    return data;
  }, [filtered, catIndex, rates, codeByCurrencyId, targetCode]);

  const total = grouped.reduce((s, x) => s + x.value, 0);
  const palette = useChartPalette();

  return (
    <div className="space-y-4">
      {ratesError ? (
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
                <Button variant="outline" size="sm" onClick={() => refreshRates(true)} loading={ratesLoading} disabled={ratesLoading}>Обновить курсы сейчас</Button>
              </div>
            </div>
            <TabsContent value="categories" className="mt-2 p-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="h-[280px]">
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
                <ul className="space-y-2">
                  {grouped.map((s, idx) => (
                    <li key={s.id} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: palette[idx % palette.length] }} />
                        {s.name}
                      </span>
                      <span className="font-medium">{`${roundMoneyAmount(s.value)} ${targetCode}`}</span>
                    </li>
                  ))}
                </ul>
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

function buildCategoryIndex(categories: Category[]) {
  const byId = new Map<string, Category>();
  for (const c of categories) byId.set(c.id, c);
  const childrenOf = new Map<string | null, Category[]>();
  for (const c of categories) {
    const parentKey = c.parentId && byId.has(c.parentId) ? c.parentId : null;
    const arr = childrenOf.get(parentKey) ?? [];
    arr.push(c);
    childrenOf.set(parentKey, arr);
  }
  return { byId, childrenOf } as const;
}

function getDescendants(id: string, childrenOf: Map<string | null, Category[]>) {
  const out: string[] = [];
  const walk = (x: string) => {
    const kids = childrenOf.get(x) ?? [];
    for (const k of kids) {
      out.push(k.id);
      walk(k.id);
    }
  };
  walk(id);
  return out;
}

function useChartPalette() {
  const [colors, setColors] = useState<string[]>([]);
  useEffect(() => {
    if (typeof window === "undefined") return;

    const resolveColor = (cssVar: string, fallback: string) => {
      const el = document.createElement("span");
      el.style.color = `var(${cssVar}, ${fallback})`;
      document.body.appendChild(el);
      const rgb = getComputedStyle(el).color || fallback;
      el.remove();
      return rgb;
    };

    const compute = () => {
      const next = [
        resolveColor("--primary", "rgb(56, 96, 255)"),
        resolveColor("--chart-1", "rgb(56, 96, 255)"),
        resolveColor("--chart-2", "rgb(56, 186, 172)"),
        resolveColor("--chart-3", "rgb(186, 56, 230)"),
        resolveColor("--chart-4", "rgb(255, 170, 32)"),
        resolveColor("--chart-5", "rgb(240, 85, 70)"),
        resolveColor("--muted-foreground", "rgb(120, 120, 120)"),
      ];
      setColors(next);
    };

    compute();

    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "attributes" && m.attributeName === "class") {
          compute();
          break;
        }
      }
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return colors.length ? colors : ["#3860FF", "#3860FF", "#38BAAC", "#BA38E6", "#FFAA20", "#F05546", "#777777"];
}

function convertToBaseFactor(txCurrencyCode: string, rates: Record<string, number>, baseCode: string) {
  if (!txCurrencyCode || !rates) return 1;
  if (txCurrencyCode === baseCode) return 1;
  const r = rates[txCurrencyCode];
  if (!r || r === 0) return 1;
  // rates map is: 1 base = r units of txCurrency
  // So X txCurrency = X / r in base
  return 1 / r;
}
