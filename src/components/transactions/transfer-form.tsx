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
import { Collections } from "@/types/collections";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { sanitizeMoneyInput, roundMoneyAmount } from "@/lib/money";

type Account = { id: string; name: string; color?: string };

export function TransferForm({ accounts, editingTx, onDone }: { accounts: Account[]; editingTx?: any | null; onDone?: () => void }) {
  const { ownerUid } = useAuth();
  const fromSelId = useId();
  const toSelId = useId();
  const dateId = useId();
  const amountId = useId();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [date, setDate] = useState(new Date());
  const [error, setError] = useState<string | null>(null);

  // default accounts
  useEffect(() => {
    if (!fromId && accounts.length > 0) {
      setFromId(accounts[0].id);
      setToId(accounts[1]?.id || accounts[0].id);
    }
  }, [accounts]);

  useEffect(() => {
    if (editingTx) {
      setFromId(editingTx.fromAccountId || "");
      setToId(editingTx.toAccountId || "");
      setAmount(editingTx.amount != null ? String(editingTx.amount) : "");
      setComment(editingTx.comment || "");
      setDate(editingTx.date?.toDate ? editingTx.date.toDate() : new Date(editingTx.date || Date.now()));
    }
  }, [editingTx]);

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
    if (!fromId || !toId || !amount.trim()) {
      setError("Заполните обязательные поля.");
      return;
    }
    if (editingTx?.id) {
      const { updateDoc, doc } = await import("firebase/firestore");
      await updateDoc(doc(db, Collections.Transactions, editingTx.id), {
        fromAccountId: fromId,
        toAccountId: toId,
        amount: Number(amount.replace(/,/g, ".")),
        comment: comment || null,
        date,
      } as any);
    } else {
      await addDoc(collection(db, Collections.Transactions), {
        type: "transfer",
        fromAccountId: fromId,
        toAccountId: toId,
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
          <Label htmlFor={fromSelId}>Счет откуда</Label>
          <Select value={fromId} onValueChange={setFromId}>
            <SelectTrigger id={fromSelId} className="w-56 font-semibold"><SelectValue placeholder="Выберите" /></SelectTrigger>
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
          <Label htmlFor={toSelId}>Счет куда</Label>
          <Select value={toId} onValueChange={setToId}>
            <SelectTrigger id={toSelId} className="w-56 font-semibold"><SelectValue placeholder="Выберите" /></SelectTrigger>
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
