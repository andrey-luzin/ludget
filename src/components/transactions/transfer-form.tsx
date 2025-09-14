"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { DatePicker } from "@/components/date-picker";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Collections } from "@/types/collections";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { sanitizeMoneyInput, roundMoneyAmount } from "@/lib/money";

type Account = { id: string; name: string };

export function TransferForm({ accounts }: { accounts: Account[] }) {
  const { ownerUid } = useAuth();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [date, setDate] = useState(new Date());
  const [error, setError] = useState<string | null>(null);

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
    setAmount("");
    setComment("");
    setError(null);
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-end justify-between gap-3">
        <div className="grid gap-1">
          <label className="text-sm font-medium">Счет откуда</label>
          <Select value={fromId} onValueChange={setFromId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Выберите" /></SelectTrigger>
            <SelectContent>
              {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium">Счет куда</label>
          <Select value={toId} onValueChange={setToId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Выберите" /></SelectTrigger>
            <SelectContent>
              {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
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
        <div className="grid gap-1 flex-1 min-w-56">
          <label className="text-sm font-medium">Комментарий</label>
          <Input placeholder="Опционально" value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      <div className="flex justify-end pt-1">
        <Button onClick={submit}>Сохранить</Button>
      </div>
    </div>
  );
}

