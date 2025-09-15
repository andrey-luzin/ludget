"use client";

import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { DatePicker } from "@/components/date-picker";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Collections, SubCollections } from "@/types/collections";
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import { sanitizeMoneyInput, roundMoneyAmount } from "@/lib/money";

type Account = { id: string; name: string; color?: string };
type Balance = { id: string; currencyId: string; amount: number };

type Currency = { id: string; name: string };

export function ExchangeForm({ accounts, currencies, editingTx, onDone }: { accounts: Account[]; currencies: Currency[]; editingTx?: any | null; onDone?: () => void }) {
  const { ownerUid } = useAuth();
  const [accountId, setAccountId] = useState("");
  const [accountBalances, setAccountBalances] = useState<Balance[]>([]);
  const [fromCurrencyId, setFromCurrencyId] = useState("");
  const [toCurrencyId, setToCurrencyId] = useState("");
  const [amountFrom, setAmountFrom] = useState("");
  const [amountTo, setAmountTo] = useState("");
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
    if (editingTx) {
      setAccountId(editingTx.accountId || "");
      setFromCurrencyId(editingTx.fromCurrencyId || "");
      setToCurrencyId(editingTx.toCurrencyId || "");
      setAmountFrom(editingTx.amountFrom != null ? String(editingTx.amountFrom) : "");
      setAmountTo(editingTx.amountTo != null ? String(editingTx.amountTo) : "");
      setComment(editingTx.comment || "");
      setDate(editingTx.date?.toDate ? editingTx.date.toDate() : new Date(editingTx.date || Date.now()));
    }
  }, [editingTx]);

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
      if (!arr.find((b) => b.currencyId === fromCurrencyId)) {
        setFromCurrencyId(arr[0]?.currencyId || "");
      }
      if (!arr.find((b) => b.currencyId === toCurrencyId)) {
        setToCurrencyId(arr[0]?.currencyId || "");
      }
    });
    return () => unsub();
  }, [ownerUid, accountId]);

  function handleAmountFromChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAmountFrom(sanitizeMoneyInput(e.target.value));
  }
  function handleAmountFromBlur() {
    const n = Number(amountFrom.replace(/,/g, "."));
    if (!isNaN(n)) setAmountFrom(String(roundMoneyAmount(n)));
  }
  function handleAmountToChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAmountTo(sanitizeMoneyInput(e.target.value));
  }
  function handleAmountToBlur() {
    const n = Number(amountTo.replace(/,/g, "."));
    if (!isNaN(n)) setAmountTo(String(roundMoneyAmount(n)));
  }

  async function submit() {
    if (!accountId || !fromCurrencyId || !toCurrencyId || !amountFrom.trim() || !amountTo.trim()) {
      setError("Заполните обязательные поля.");
      return;
    }
    if (editingTx?.id) {
      const { updateDoc, doc } = await import("firebase/firestore");
      await updateDoc(doc(db, Collections.Transactions, editingTx.id), {
        accountId,
        fromCurrencyId,
        toCurrencyId,
        amountFrom: Number(amountFrom.replace(/,/g, ".")),
        amountTo: Number(amountTo.replace(/,/g, ".")),
        comment: comment || null,
        date,
      } as any);
    } else {
      await addDoc(collection(db, Collections.Transactions), {
        type: "exchange",
        accountId,
        fromCurrencyId,
        toCurrencyId,
        amountFrom: Number(amountFrom.replace(/,/g, ".")),
        amountTo: Number(amountTo.replace(/,/g, ".")),
        comment: comment || null,
        date,
        ownerUid,
        createdAt: serverTimestamp(),
      });
    }
    setAmountFrom("");
    setAmountTo("");
    setComment("");
    setError(null);
    onDone?.();
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-end justify-between gap-3">
        <div className="grid gap-1">
          <label className="text-sm font-medium">Счет</label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-56 font-semibold"><SelectValue placeholder="Выберите" /></SelectTrigger>
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
          <label className="text-sm font-medium">Дата</label>
          <DatePicker value={date} onChange={setDate} />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <label className="text-sm font-medium">Продали (валюта)</label>
          <Select value={fromCurrencyId} onValueChange={setFromCurrencyId}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Выберите" /></SelectTrigger>
            <SelectContent>
              {accountBalances.map((b) => <SelectItem key={b.id} value={b.currencyId}>{currencyName(b.currencyId)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium">Сколько продали</label>
          <Input className="w-40" type="text" placeholder="0.0" value={amountFrom} onChange={handleAmountFromChange} onBlur={handleAmountFromBlur} />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <label className="text-sm font-medium">Купили (валюта)</label>
          <Select value={toCurrencyId} onValueChange={setToCurrencyId}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Выберите" /></SelectTrigger>
            <SelectContent>
              {accountBalances.map((b) => <SelectItem key={b.id} value={b.currencyId}>{currencyName(b.currencyId)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium">Сколько купили</label>
          <Input className="w-40" type="text" placeholder="0.0" value={amountTo} onChange={handleAmountToChange} onBlur={handleAmountToBlur} />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1 flex-1 min-w-56">
          <label className="text-sm font-medium">Комментарий</label>
          <Input placeholder="Опционально" value={comment} onChange={(e) => setComment(e.target.value)} />
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
