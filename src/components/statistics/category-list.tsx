"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { roundMoneyAmount, formatMoneyAmount } from "@/lib/money";
import type { Category } from "@/types/entities";
import { getDescendants } from "@/lib/categories";
import type { Account } from "@/types/entities";

type FireTimestamp = { toDate: () => Date };
type Tx = {
  id: string;
  amount: number;
  date: Date | FireTimestamp | string | number;
  categoryId?: string | null;
  accountId?: string | null;
  currencyId?: string | null;
  comment?: string | null;
  createdBy?: string | null;
};

function normalizeDate(input: Tx["date"]): Date {
  if (!input) return new Date(0);
  if (typeof input === "string" || typeof input === "number") return new Date(input);
  if (typeof (input as any).toDate === "function") return (input as FireTimestamp).toDate();
  return input as Date;
}

export function CategoryListWithPopover({
  data,
  palette,
  items,
  catIndex,
  codeByCurrencyId,
  targetCode,
  accounts,
}: {
  data: { id: string; name: string; value: number }[];
  palette: string[];
  items: Tx[];
  catIndex: { byId: Map<string, Category>; childrenOf: Map<string | null, Category[]> };
  codeByCurrencyId: Map<string, string>;
  targetCode?: string;
  accounts: Account[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const accountById = new Map(accounts.map((a) => [a.id, a] as const));

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
    const txCurCode = codeByCurrencyId.get(tx.currencyId || "") || targetCode;
    const val = formatMoneyAmount(Number(tx.amount || 0));
    if (!targetCode || !txCurCode) return val;
    return `${val} ${txCurCode}`;
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
            <PopoverContent align="start" className="w-[360px] max-h-80 overflow-y-auto p-0">
              <div className="p-2 border-b text-xs text-muted-foreground">Транзакции</div>
              <ul className="divide-y">
                {txFor(s.id).map((tx) => {
                  const d = normalizeDate(tx.date);
                  const acc = tx.accountId ? accountById.get(tx.accountId) : undefined;
                  const c = (tx.comment || "").trim();
                  return (
                    <li key={tx.id} className="p-2 text-sm grid grid-cols-1 gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{d.toLocaleDateString()}</span>
                        <span className="font-medium">{formatAmount(tx)}</span>
                      </div>
                      {acc ? (
                        <div className="flex items-center justify-between text-xs">
                          <span className="inline-flex items-center gap-2 text-muted-foreground">
                            {acc.iconUrl ? <img src={acc.iconUrl} alt="" className="h-4 w-4 object-contain" /> : null}
                            <span style={{ color: acc.color || undefined }}>{acc.name}</span>
                          </span>
                          {c ? (
                            <span className="text-muted-foreground/80 truncate max-w-[55%]" title={c}>{c}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
                {txFor(s.id).length === 0 ? (
                  <li className="p-3 text-center text-muted-foreground text-sm">Нет транзакций</li>
                ) : null}
              </ul>
            </PopoverContent>
          </Popover>
          <span className="font-medium">{`${formatMoneyAmount(s.value)} ${targetCode || ""}`}</span>
        </li>
      ))}
    </ul>
  );
}
