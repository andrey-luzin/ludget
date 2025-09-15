"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Collections } from "@/types/collections";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { formatISO, parseISO, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    if (accountFilter === ALL) {
      return items;
    }
    return items.filter(
      (it) => it.accountId === accountFilter || it.fromAccountId === accountFilter || it.toAccountId === accountFilter
    );
  }, [items, accountFilter]);

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
      <div className="mb-2 flex items-end gap-2">
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
