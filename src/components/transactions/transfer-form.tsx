"use client";

import { useEffect, useMemo, useState, useId } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { DatePicker } from "@/components/date-picker";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/contexts/i18n-context";

import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Collections } from "@/types/collections";
import { applyBalanceAdjustments } from "@/lib/account-balances";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { evaluateAmountExpression, sanitizeMoneyInput, roundMoneyAmount, getAmountPreview } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Account, Currency } from "@/types/entities";

export function TransferForm({ accounts, currencies, editingTx, onDone }: { accounts: Account[]; currencies: Currency[]; editingTx?: any | null; onDone?: () => void }) {
  const { ownerUid, userUid, showOnlyMyAccounts } = useAuth();
  const fromSelId = useId();
  const toSelId = useId();
  const dateId = useId();
  const amountId = useId();
  const currencySelId = useId();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [comment, setComment] = useState("");
  const [date, setDate] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();
  const submitLabel = editingTx ? t("transfer.submit.save") : t("transfer.submit.add");
  const amountPreview = useMemo(() => getAmountPreview(amount), [amount]);

  // default accounts
  const visibleAccounts = useMemo(() => {
    if (!showOnlyMyAccounts || !userUid) return accounts;
    return accounts.filter((acc) => (acc.createdBy ?? ownerUid) === userUid);
  }, [accounts, showOnlyMyAccounts, userUid, ownerUid]);

  useEffect(() => {
    if (visibleAccounts.length === 0) {
      if (fromId) setFromId("");
      if (toId) setToId("");
      return;
    }
    if (!fromId || !visibleAccounts.some((acc) => acc.id === fromId)) {
      setFromId(visibleAccounts[0].id);
    }
    if (!toId || !visibleAccounts.some((acc) => acc.id === toId)) {
      setToId(visibleAccounts[Math.min(1, visibleAccounts.length - 1)].id);
    }
  }, [visibleAccounts, fromId, toId]);

  useEffect(() => {
    if (editingTx) {
      setFromId(editingTx.fromAccountId || "");
      setToId(editingTx.toAccountId || "");
      setAmount(editingTx.amount != null ? String(editingTx.amount) : "");
      setCurrencyId(editingTx.currencyId || "");
      setComment(editingTx.comment || "");
      setDate(editingTx.date?.toDate ? editingTx.date.toDate() : new Date(editingTx.date || Date.now()));
    }
  }, [editingTx]);

  useEffect(() => {
    if (editingTx?.currencyId) {
      return;
    }
    if (!currencyId && currencies.length > 0) {
      setCurrencyId(currencies[0].id);
    }
  }, [currencies, currencyId, editingTx]);

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAmount(sanitizeMoneyInput(e.target.value));
  }

  async function submit() {
    if (!fromId || !toId || !currencyId || !amount.trim()) {
      setError(t("transfer.errors.required"));
      return;
    }
    const evaluated = evaluateAmountExpression(amount);
    if (evaluated == null) {
      setError(t("transfer.errors.amount_expr"));
      return;
    }
    const normalizedAmount = Number(roundMoneyAmount(evaluated).toFixed(2));
    const adjustments = [] as { accountId: string; currencyId: string; delta: number }[];

    try {
      if (editingTx?.id) {
        const { updateDoc, doc } = await import("firebase/firestore");
        const prevAmount = Number(editingTx.amount ?? 0);
        if (editingTx.fromAccountId && editingTx.currencyId && prevAmount) {
          adjustments.push({ accountId: editingTx.fromAccountId, currencyId: editingTx.currencyId, delta: prevAmount });
        }
        if (editingTx.toAccountId && editingTx.currencyId && prevAmount) {
          adjustments.push({ accountId: editingTx.toAccountId, currencyId: editingTx.currencyId, delta: -prevAmount });
        }
        await updateDoc(doc(db, Collections.Transactions, editingTx.id), {
          fromAccountId: fromId,
          toAccountId: toId,
          currencyId,
          amount: normalizedAmount,
          comment: comment || null,
          date,
        } as any);
      } else {
        await addDoc(collection(db, Collections.Transactions), {
          type: "transfer",
          fromAccountId: fromId,
          toAccountId: toId,
          currencyId,
          amount: normalizedAmount,
          comment: comment || null,
          date,
          ownerUid,
          createdAt: serverTimestamp(),
        });
      }

      adjustments.push({ accountId: fromId, currencyId, delta: -normalizedAmount });
      adjustments.push({ accountId: toId, currencyId, delta: normalizedAmount });
      await applyBalanceAdjustments(ownerUid, adjustments);

      setAmount("");
      setCurrencyId(currencies[0]?.id ?? "");
      setComment("");
      setError(null);
      onDone?.();
    } catch (err) {
      console.error("Failed to save transfer transaction", err);
      setError(t("transfer.errors.save_failed"));
    }
  }

  function handleMetaEnterSubmit(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      submit();
    }
  }

  return (
    <div className="grid gap-4" onKeyDownCapture={handleMetaEnterSubmit}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="grid gap-1">
          <Label htmlFor={fromSelId}>{t("transfer.from")}</Label>
          <Select value={fromId} onValueChange={setFromId}>
            <SelectTrigger id={fromSelId} className="font-semibold sm:w-64">
              <SelectValue placeholder={t("common.choose")} />
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
        <div className="grid gap-1">
          <Label htmlFor={toSelId}>{t("transfer.to")}</Label>
          <Select value={toId} onValueChange={setToId}>
            <SelectTrigger id={toSelId} className="font-semibold sm:w-56">
              <SelectValue placeholder={t("common.choose")} />
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
      </div>

      <div className="flex gap-3 grow max-sm:flex-col">
        <div className="flex gap-3">
          <div className="grid gap-1 grow">
            <Label htmlFor={amountId}>{t("common.amount")}</Label>
            <div className="relative">
              <Input
                id={amountId}
                className={cn("w-full sm:w-64", amountPreview ? "pr-16" : undefined)}
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
          <div className="grid gap-1 w-26 sm:w-44">
            <Label htmlFor={currencySelId}>{t("common.currency")}</Label>
            <Select value={currencyId} onValueChange={setCurrencyId}>
              <SelectTrigger id={currencySelId} className="w-full">
                <SelectValue placeholder="Выберите" />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((currency) => (
                  <SelectItem key={currency.id} value={currency.id}>
                    {currency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid flex-1 gap-1">
          <label className="text-sm font-medium">{t("common.comment")}</label>
          <Input placeholder={t("common.optional")} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      <div className="flex justify-between items-end gap-2 pt-1">
        <div className="grid gap-1 md:w-auto">
          <Label htmlFor={dateId}>{t("common.date")}</Label>
          <DatePicker value={date} onChange={setDate} triggerId={dateId} triggerClassName="w-full sm:w-auto" />
        </div>
        {editingTx ? (
          <Button variant="ghost" onClick={() => onDone?.()}>{t("common.cancel")}</Button>
        ) : null}
        <Button onClick={submit}>{submitLabel}</Button>
      </div>
    </div>
  );
}
