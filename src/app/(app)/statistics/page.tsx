"use client";

import { useEffect, useMemo, useState } from "react";
import { DateRangePicker, type DateRange } from "@/components/filters/date-range-picker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { Collections } from "@/types/collections";
import type { Category } from "@/types/entities";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { CategoryMultiSelect } from "@/components/statistics/category-multiselect";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

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

  const grouped = useMemo(() => {
    const byId = new Map<string, number>();
    for (const it of filtered) {
      const id = it.categoryId ?? "__uncat__";
      byId.set(id, (byId.get(id) || 0) + Number(it.amount || 0));
    }
    const data = Array.from(byId.entries()).map(([id, value]) => ({ id, name: catIndex.byId.get(id)?.name ?? "Без категории", value }));
    data.sort((a, b) => b.value - a.value);
    return data;
  }, [filtered, catIndex]);

  const total = grouped.reduce((s, x) => s + x.value, 0);

  return (
    <div className="p-4 lg:p-6 space-y-4">
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
            <div className="text-2xl font-semibold">{formatCurrency(total)}</div>
          </div>
        </div>
        <div className="px-2 pb-4">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <div className="flex items-center justify-between px-2">
              <TabsList>
                <TabsTrigger value="categories">Категории</TabsTrigger>
              </TabsList>
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
                      <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
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
                      <span className="font-medium">{formatCurrency(s.value)}</span>
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

function formatCurrency(v: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(v);
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

const palette = [
  "hsl(var(--primary))",
  "hsl(var(--chart-1, 220 70% 50%))",
  "hsl(var(--chart-2, 280 65% 55%))",
  "hsl(var(--chart-3, 340 75% 55%))",
  "hsl(var(--chart-4, 30 85% 55%))",
  "hsl(var(--chart-5, 160 60% 45%))",
  "hsl(var(--muted-foreground))",
];
