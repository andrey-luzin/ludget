"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { roundMoneyAmount } from "@/lib/money";
import type { Category } from "@/types/entities";
import { getDescendants } from "@/lib/categories";

type Tx = { id: string; amount: number; date: any; categoryId?: string | null };

export function CategoryListWithPopover({
  data,
  palette,
  items,
  catIndex,
  codeByCurrencyId,
  targetCode,
}: {
  data: { id: string; name: string; value: number }[];
  palette: string[];
  items: Tx[];
  catIndex: { byId: Map<string, Category>; childrenOf: Map<string | null, Category[]> };
  codeByCurrencyId: Map<string, string>;
  targetCode?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const getAllIdsForGroup = (id: string) => {
    if (id === "__uncat__") return [id];
    const ids = new Set<string>([id]);
    for (const d of getDescendants(id, catIndex.childrenOf)) ids.add(d);
    return Array.from(ids);
  };

  const txFor = (id: string) => {
    if (id === "__uncat__") return items.filter((it) => !it.categoryId);
    const ids = new Set(getAllIdsForGroup(id));
    return items.filter((it) => ids.has(it.categoryId || ""));
  };

  const formatAmount = (tx: Tx) => {
    const txCurCode = codeByCurrencyId.get((tx as any).currencyId) || targetCode;
    if (!targetCode || !txCurCode) return `${roundMoneyAmount(Number(tx.amount || 0))}`;
    return `${roundMoneyAmount(Number(tx.amount || 0))} ${txCurCode}`;
  };

  return (
    <ul className="space-y-2">
      {data.map((s, idx) => (
        <li key={s.id} className="flex items-center justify-between text-sm">
          <Popover open={openId === s.id} onOpenChange={(o) => setOpenId(o ? s.id : null)}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 text-muted-foreground hover:underline"
                onClick={() => setOpenId(openId === s.id ? null : s.id)}
              >
                <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: palette[idx % palette.length] }} />
                {s.name}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[320px] max-h-80 overflow-y-auto p-0">
              <div className="p-2 border-b text-xs text-muted-foreground">Транзакции</div>
              <ul className="divide-y">
                {txFor(s.id).map((tx) => {
                  const d: Date = (tx as any).date?.toDate ? (tx as any).date.toDate() : new Date((tx as any).date);
                  return (
                    <li key={tx.id} className="p-2 text-sm flex items-center justify-between">
                      <span className="text-muted-foreground">{d.toLocaleDateString()}</span>
                      <span className="font-medium">{formatAmount(tx)}</span>
                    </li>
                  );
                })}
                {txFor(s.id).length === 0 ? (
                  <li className="p-3 text-center text-muted-foreground text-sm">Нет транзакций</li>
                ) : null}
              </ul>
            </PopoverContent>
          </Popover>
          <span className="font-medium">{`${roundMoneyAmount(s.value)} ${targetCode || ""}`}</span>
        </li>
      ))}
    </ul>
  );
}

