"use client";

import { useEffect, useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { DatePicker } from "@/components/date-picker";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Collections, SubCollections } from "@/types/collections";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, where } from "firebase/firestore";
import { sanitizeMoneyInput, roundMoneyAmount } from "@/lib/money";

type Account = { id: string; name: string; color?: string };
type Balance = { id: string; currencyId: string; amount: number };
type Currency = { id: string; name: string };
type Category = { id: string; name: string; parentId?: string | null };

export function ExpenseForm({ accounts, currencies, categories, editingTx, onDone }: {
  accounts: Account[];
  currencies: Currency[];
  categories: Category[];
  editingTx?: any | null;
  onDone?: () => void;
}) {
  const { ownerUid } = useAuth();
  const [accountId, setAccountId] = useState("");
  const [accountBalances, setAccountBalances] = useState<Balance[]>([]);
  const [currencyId, setCurrencyId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [date, setDate] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const currencyName = (id: string) => currencies.find((c) => c.id === id)?.name ?? id;

  // default account
  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].id);
    }
  }, [accounts]);

  // Prefill from editingTx
  useEffect(() => {
    if (editingTx) {
      setAccountId(editingTx.accountId || "");
      setCurrencyId(editingTx.currencyId || "");
      setCategoryId(editingTx.categoryId || "");
      setAmount(editingTx.amount != null ? String(editingTx.amount) : "");
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
      if (!arr.find((b) => b.currencyId === currencyId)) {
        setCurrencyId(arr[0]?.currencyId || "");
      }
    });
    return () => unsub();
  }, [ownerUid, accountId]);

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAmount(sanitizeMoneyInput(e.target.value));
    // setAmount(e.target.value);
  }
  function handleAmountBlur() {
    const n = Number(amount.replace(/,/g, "."));
    if (!isNaN(n)) {
      const v = roundMoneyAmount(n);
      setAmount(String(v));
    }
  }

  async function submit() {
    if (!accountId || !currencyId || !categoryId || !amount.trim()) {
      setError("Заполните обязательные поля.");
      return;
    }
    if (editingTx?.id) {
      const { updateDoc, doc } = await import("firebase/firestore");
      await updateDoc(doc(db, Collections.Transactions, editingTx.id), {
        accountId,
        currencyId,
        categoryId,
        amount: Number(amount.replace(/,/g, ".")),
        comment: comment || null,
        date,
      } as any);
    } else {
      await addDoc(collection(db, Collections.Transactions), {
        type: "expense",
        accountId,
        currencyId,
        categoryId,
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

  const categoriesFlat = useMemo(() => categories, [categories]);

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
          <label className="text-sm font-medium">Сумма</label>
          <Input className="w-40" type="text" placeholder="0.0" value={amount} onChange={handleAmountChange} onBlur={handleAmountBlur} />
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium">Валюта</label>
          <Select value={currencyId} onValueChange={setCurrencyId}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Выберите" /></SelectTrigger>
            <SelectContent>
              {accountBalances.map((b) => <SelectItem key={b.id} value={b.currencyId}>{currencyName(b.currencyId)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <label className="text-sm font-medium">Категория</label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Выберите" /></SelectTrigger>
            <SelectContent>
              {categoriesFlat.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className={c.parentId ? "ml-4" : undefined}>{c.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
