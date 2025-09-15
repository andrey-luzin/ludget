"use client";

import { useEffect, useState, useId } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { DatePicker } from "@/components/date-picker";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Collections, SubCollections } from "@/types/collections";
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import { sanitizeMoneyInput, roundMoneyAmount } from "@/lib/money";

type Account = { id: string; name: string; color?: string };
type Balance = { id: string; currencyId: string; amount: number };
type Source = { id: string; name: string; parentId?: string | null };

type Currency = { id: string; name: string };

export function IncomeForm({ accounts, sources, currencies, editingTx, onDone }: {
  accounts: Account[];
  sources: Source[];
  currencies: Currency[];
  editingTx?: any | null;
  onDone?: () => void;
}) {
  const { ownerUid } = useAuth();
  const accSelId = useId();
  const dateId = useId();
  const amountId = useId();
  const currencySelId = useId();
  const sourceSelId = useId();
  const commentId = useId();
  const [accountId, setAccountId] = useState("");
  const [accountBalances, setAccountBalances] = useState<Balance[]>([]);
  const [currencyId, setCurrencyId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [date, setDate] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const currencyName = (id: string) => currencies.find((c) => c.id === id)?.name ?? id;

  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].id);
    }
  }, [accounts]);

  useEffect(() => {
    if (!ownerUid || !accountId) {
      setAccountBalances([]);
      return;
    }
    const q = query(
      collection(db, Collections.Accounts, accountId, SubCollections.Balances),
      where("ownerUid", "==", ownerUid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map((d) => {
        const data = d.data() as any;
        return { id: d.id, currencyId: String(data.currencyId), amount: Number(data.amount) } as Balance;
      });
      setAccountBalances(arr);
      if (!arr.find((b) => b.currencyId === currencyId)) {
        setCurrencyId(arr[0]?.currencyId || "");
      }
    });
    return () => unsub();
  }, [ownerUid, accountId]);

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAmount(sanitizeMoneyInput(e.target.value));
  }
  function handleAmountBlur() {
    const n = Number(amount.replace(/,/g, "."));
    if (!isNaN(n)) {
      const v = roundMoneyAmount(n);
      setAmount(String(v));
    }
  }

  async function submit() {
    if (!accountId || !currencyId || !sourceId || !amount.trim()) {
      setError("Заполните обязательные поля.");
      return;
    }
    if (editingTx?.id) {
      const { updateDoc, doc } = await import("firebase/firestore");
      await updateDoc(doc(db, Collections.Transactions, editingTx.id), {
        accountId,
        currencyId,
        sourceId,
        amount: Number(amount.replace(/,/g, ".")),
        comment: comment || null,
        date,
      } as any);
    } else {
      await addDoc(collection(db, Collections.Transactions), {
        type: "income",
        accountId,
        currencyId,
        sourceId,
        amount: Number(amount.replace(/,/g, ".")),
        comment: comment || null,
        date,
        ownerUid,
        createdAt: serverTimestamp(),
      });
    }
    setAmount("");
    setComment("");
    setError(null);
    onDone?.();
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-end justify-between gap-3">
        <div className="grid gap-1">
          <Label htmlFor={accSelId}>Счет</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger id={accSelId} className="w-56 font-semibold"><SelectValue placeholder="Выберите" /></SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className="font-semibold" style={{ color: a.color || undefined }}>{a.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor={dateId}>Дата</Label>
          <DatePicker value={date} onChange={setDate} triggerId={dateId} />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label htmlFor={amountId}>Сумма</Label>
          <Input id={amountId} className="w-40" type="text" placeholder="0.0" value={amount} onChange={handleAmountChange} onBlur={handleAmountBlur} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={currencySelId}>Валюта</Label>
          <Select value={currencyId} onValueChange={setCurrencyId}>
            <SelectTrigger id={currencySelId} className="w-40"><SelectValue placeholder="Выберите" /></SelectTrigger>
            <SelectContent>
              {accountBalances.map((b) => <SelectItem key={b.id} value={b.currencyId}>{currencyName(b.currencyId)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label htmlFor={sourceSelId}>Источник</Label>
          <Select value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger id={sourceSelId} className="w-64"><SelectValue placeholder="Выберите" /></SelectTrigger>
            <SelectContent>
              {sources.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className={s.parentId ? "ml-4" : undefined}>{s.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1 flex-1 min-w-56">
          <Label htmlFor={commentId}>Комментарий</Label>
          <Input id={commentId} placeholder="Опционально" value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      <div className="flex justify-end gap-2 pt-1">
        {editingTx ? (
          <Button variant="ghost" onClick={() => onDone?.()}>Отменить</Button>
        ) : null}
        <Button onClick={submit}>Сохранить</Button>
      </div>
    </div>
  );
}
