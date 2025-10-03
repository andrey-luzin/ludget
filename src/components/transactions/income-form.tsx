"use client";

import { useEffect, useMemo, useState, useId } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { DatePicker } from "@/components/date-picker";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Collections } from "@/types/collections";
import { applyBalanceAdjustments } from "@/lib/account-balances";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { evaluateAmountExpression, sanitizeMoneyInput, roundMoneyAmount, getAmountPreview } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Account, Currency, Source } from "@/types/entities";

export function IncomeForm({ accounts, sources, currencies, editingTx, onDone }: {
  accounts: Account[];
  sources: Source[];
  currencies: Currency[];
  editingTx?: any | null;
  onDone?: () => void;
}) {
  const { ownerUid, userUid, showOnlyMyAccounts } = useAuth();
  const accSelId = useId();
  const dateId = useId();
  const amountId = useId();
  const currencySelId = useId();
  const sourceSelId = useId();
  const commentId = useId();
  const [accountId, setAccountId] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [date, setDate] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const currencyName = (id: string) => currencies.find((c) => c.id === id)?.name ?? id;
  const submitLabel = editingTx ? "Сохранить" : "Добавить";
  const amountPreview = useMemo(() => getAmountPreview(amount), [amount]);

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

  useEffect(() => {
    if (!currencies.length) {
      setCurrencyId("");
      return;
    }
    setCurrencyId((prev) => {
      if (prev && currencies.some((c) => c.id === prev)) {
        return prev;
      }
      return currencies[0]?.id ?? "";
    });
  }, [currencies, accountId]);

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAmount(sanitizeMoneyInput(e.target.value));
  }

  async function submit() {
    if (!accountId || !currencyId || !sourceId || !amount.trim()) {
      setError("Заполните обязательные поля.");
      return;
    }
    const evaluated = evaluateAmountExpression(amount);
    if (evaluated == null) {
      setError("Введите корректное выражение суммы.");
      return;
    }
    const normalizedAmount = Number(roundMoneyAmount(evaluated).toFixed(2));
    const adjustments = [] as { accountId: string; currencyId: string; delta: number }[];

    try {
      if (editingTx?.id) {
        const { updateDoc, doc } = await import("firebase/firestore");
        const prevAmount = Number(editingTx.amount ?? 0);
        if (editingTx.accountId && editingTx.currencyId && prevAmount) {
          adjustments.push({ accountId: editingTx.accountId, currencyId: editingTx.currencyId, delta: -prevAmount });
        }
        await updateDoc(doc(db, Collections.Transactions, editingTx.id), {
          accountId,
          currencyId,
          sourceId,
          amount: normalizedAmount,
          comment: comment || null,
          date,
        } as any);
      } else {
        await addDoc(collection(db, Collections.Transactions), {
          type: "income",
          accountId,
          currencyId,
          sourceId,
          amount: normalizedAmount,
          comment: comment || null,
          date,
          ownerUid,
          createdAt: serverTimestamp(),
        });
      }

      adjustments.push({ accountId, currencyId, delta: normalizedAmount });
      await applyBalanceAdjustments(ownerUid, adjustments);

      setAmount("");
      setComment("");
      setError(null);
      onDone?.();
    } catch (err) {
      console.error("Failed to save income transaction", err);
      setError("Не удалось сохранить транзакцию. Попробуйте ещё раз.");
    }
  }

  const compareSourceOrder = (a: Source, b: Source) => {
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.name.localeCompare(b.name, "ru", { sensitivity: "base" });
  };

  const orderedSources = useMemo(() => {
    const byId = new Map(sources.map((source) => [source.id, source] as const));
    const grouped = new Map<string | null, Source[]>();
    for (const source of sources) {
      const parentKey = source.parentId && byId.has(source.parentId) ? source.parentId : null;
      const list = grouped.get(parentKey) ?? [];
      list.push(source);
      grouped.set(parentKey, list);
    }
    const sortSources = (arr: Source[]) => [...arr].sort(compareSourceOrder);

    const result: Source[] = [];
    const visited = new Set<string>();

    const visit = (source: Source) => {
      if (visited.has(source.id)) {
        return;
      }
      visited.add(source.id);
      result.push(source);
      const children = grouped.get(source.id);
      if (children && children.length) {
        for (const child of sortSources(children)) {
          visit(child);
        }
      }
    };

    const roots = sortSources(grouped.get(null) ?? sources.filter((source) => !source.parentId || !byId.has(source.parentId)));
    for (const root of roots) {
      visit(root);
    }

    for (const source of sources) {
      if (!visited.has(source.id)) {
        visit(source);
      }
    }

    return result;
  }, [sources]);

  function handleMetaEnterSubmit(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      submit();
    }
  }

  return (
    <div className="grid gap-4" onKeyDownCapture={handleMetaEnterSubmit}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid gap-1">
          <Label htmlFor={accSelId}>Счет</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger id={accSelId} className="font-semibold sm:w-56">
              <SelectValue placeholder="Выберите" />
            </SelectTrigger>
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
        <div className="grid gap-1 md:w-auto">
          <Label htmlFor={dateId}>Дата</Label>
          <DatePicker value={date} onChange={setDate} triggerId={dateId} triggerClassName="w-full sm:w-auto" />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="grid gap-1">
          <Label htmlFor={amountId}>Сумма</Label>
          <div className="relative">
            <Input
              id={amountId}
              className={cn("w-full sm:w-56", amountPreview ? "pr-16" : undefined)}
              type="text"
              placeholder="0.0"
              value={amount}
              onChange={handleAmountChange}
            />
            {amountPreview ? (
              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">
                {amountPreview}
              </span>
            ) : null}
          </div>
        </div>
        <div className="grid gap-1 sm:w-44">
          <Label htmlFor={currencySelId}>Валюта</Label>
          <Select value={currencyId} onValueChange={setCurrencyId}>
            <SelectTrigger id={currencySelId} className="w-full">
              <SelectValue placeholder="Выберите" />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{currencyName(c.id)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="grid gap-1">
          <Label htmlFor={sourceSelId}>Источник</Label>
          <Select value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger id={sourceSelId} className="w-full sm:w-64">
              <SelectValue placeholder="Выберите" />
            </SelectTrigger>
            <SelectContent>
              {orderedSources.map((source) => (
                <SelectItem key={source.id} value={source.id}>
                  <span className={source.parentId ? "ml-4" : undefined}>{source.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid min-w-0 flex-1 gap-1">
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
