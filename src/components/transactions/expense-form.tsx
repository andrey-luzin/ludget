"use client";

import { useEffect, useMemo, useState, useId } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { DatePicker } from "@/components/date-picker";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Collections, SubCollections } from "@/types/collections";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, where, updateDoc, doc } from "firebase/firestore";
import { sanitizeMoneyInput, roundMoneyAmount } from "@/lib/money";
import type { Account, Balance, Category, Currency } from "@/types/entities";

export function ExpenseForm({ accounts, currencies, categories, editingTx, onDone }: {
  accounts: Account[];
  currencies: Currency[];
  categories: Category[];
  editingTx?: any | null;
  onDone?: () => void;
}) {
  const { ownerUid, userUid, showOnlyMyAccounts } = useAuth();
  const accSelId = useId();
  const dateId = useId();
  const amountId = useId();
  const currencySelId = useId();
  const categorySelId = useId();
  const commentId = useId();
  const [accountId, setAccountId] = useState("");
  const [accountBalances, setAccountBalances] = useState<Balance[]>([]);
  const [currencyId, setCurrencyId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [date, setDate] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const currencyName = (id: string) => currencies.find((c) => c.id === id)?.name ?? id;
  const submitLabel = editingTx ? "Сохранить" : "Добавить";

  const visibleAccounts = useMemo(() => {
    if (!showOnlyMyAccounts || !userUid) return accounts;
    return accounts.filter((acc) => (acc.createdBy ?? ownerUid) === userUid);
  }, [accounts, showOnlyMyAccounts, userUid, ownerUid]);

  useEffect(() => {
    if (visibleAccounts.length === 0) {
      if (accountId) setAccountId("");
      return;
    }
    if (!accountId || !visibleAccounts.some((acc) => acc.id === accountId)) {
      setAccountId(visibleAccounts[0].id);
    }
  }, [visibleAccounts, accountId]);

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

  const categoryOptions = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c] as const));
    const grouped = new Map<string | null, Category[]>();
    for (const category of categories) {
      const parentKey = category.parentId && byId.has(category.parentId) ? category.parentId : null;
      const list = grouped.get(parentKey) ?? [];
      list.push(category);
      grouped.set(parentKey, list);
    }
    const sortCategories = (arr: Category[]) =>
      [...arr].sort((a, b) => a.name.localeCompare(b.name, "ru", { sensitivity: "base" }));

    const result: ComboboxOption[] = [];
    const visited = new Set<string>();

    const visit = (category: Category, depth: number) => {
      if (visited.has(category.id)) {
        return;
      }
      visited.add(category.id);
      const parentName = category.parentId ? byId.get(category.parentId)?.name : undefined;
      result.push({
        value: category.id,
        label: category.name,
        keywords: parentName ? [parentName] : undefined,
        style: depth > 0 ? { paddingLeft: Math.min(depth, 4) * 20 } : undefined,
      });
      const children = grouped.get(category.id);
      if (children && children.length) {
        for (const child of sortCategories(children)) {
          visit(child, depth + 1);
        }
      }
    };

    const roots = sortCategories(grouped.get(null) ?? categories.filter((c) => !c.parentId || !byId.has(c.parentId)));
    for (const root of roots) {
      visit(root, 0);
    }

    // Handle any categories not reachable due to broken parent references
    for (const category of categories) {
      if (!visited.has(category.id)) {
        visit(category, 0);
      }
    }

    return result;
  }, [categories]);

  return (
    <div className="grid gap-3">
      <div className="flex items-end justify-between gap-3">
        <div className="grid gap-1">
          <Label htmlFor={accSelId}>Счет</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger id={accSelId} className="w-56 font-semibold"><SelectValue placeholder="Выберите" /></SelectTrigger>
            <SelectContent>
              {visibleAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className="flex items-center gap-2">
                    {a.iconUrl ? <img src={a.iconUrl} alt="" className="h-4 w-4 object-contain" /> : null}
                    <span className="font-semibold" style={{ color: a.color || undefined }}>{a.name}</span>
                  </span>
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
          <Label htmlFor={categorySelId}>Категория</Label>
          <Combobox
            id={categorySelId}
            value={categoryId}
            onChange={setCategoryId}
            options={categoryOptions}
            placeholder="Выберите"
            searchPlaceholder="Поиск категории"
            triggerClassName="w-64 justify-between"
          />
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
        <Button onClick={submit}>{submitLabel}</Button>
      </div>
    </div>
  );
}
