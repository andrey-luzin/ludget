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
import { addDoc, collection, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { evaluateAmountExpression, sanitizeMoneyInput, roundMoneyAmount, getAmountPreview } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Account, Currency } from "@/types/entities";

export function ExchangeForm({ accounts, currencies, editingTx, onDone }: { accounts: Account[]; currencies: Currency[]; editingTx?: any | null; onDone?: () => void }) {
  const { ownerUid, userUid, showOnlyMyAccounts } = useAuth();
  const { t } = useI18n();
  const accSelId = useId();
  const dateId = useId();
  const fromCurSelId = useId();
  const fromAmtId = useId();
  const toCurSelId = useId();
  const toAmtId = useId();
  const commentId = useId();
  const [accountId, setAccountId] = useState("");
  const [fromCurrencyId, setFromCurrencyId] = useState("");
  const [toCurrencyId, setToCurrencyId] = useState("");
  const [amountFrom, setAmountFrom] = useState("");
  const [amountTo, setAmountTo] = useState("");
  const [comment, setComment] = useState("");
  const [date, setDate] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const currencyName = (id: string) => currencies.find((c) => c.id === id)?.name ?? id;
  const submitLabel = editingTx ? t("transfer.submit.save") : t("transfer.submit.add");
  const amountFromPreview = useMemo(() => getAmountPreview(amountFrom), [amountFrom]);
  const amountToPreview = useMemo(() => getAmountPreview(amountTo), [amountTo]);
  const sameCurrencyError = t("exchange.same_currency_error");

  useEffect(() => {
    if (!currencies.length) {
      setFromCurrencyId("");
      setToCurrencyId("");
      return;
    }
    setFromCurrencyId((prev) => {
      if (prev && currencies.some((c) => c.id === prev)) {
        return prev;
      }
      return currencies[0]?.id ?? "";
    });
    setToCurrencyId((prev) => {
      if (prev && currencies.some((c) => c.id === prev)) {
        return prev;
      }
      return currencies[Math.min(1, currencies.length - 1)]?.id ?? currencies[0]?.id ?? "";
    });
  }, [currencies, accountId]);

  useEffect(() => {
    setError((prev) => (prev === sameCurrencyError && fromCurrencyId !== toCurrencyId ? null : prev));
  }, [fromCurrencyId, toCurrencyId]);

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

  function handleAmountFromChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAmountFrom(sanitizeMoneyInput(e.target.value));
  }
  function handleAmountToChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAmountTo(sanitizeMoneyInput(e.target.value));
  }

  async function submit() {
    if (!accountId || !fromCurrencyId || !toCurrencyId || !amountFrom.trim() || !amountTo.trim()) {
      setError(t("transfer.errors.required"));
      return;
    }
    if (fromCurrencyId === toCurrencyId) {
      setError(sameCurrencyError);
      return;
    }
    const evaluatedFrom = evaluateAmountExpression(amountFrom);
    const evaluatedTo = evaluateAmountExpression(amountTo);
    if (evaluatedFrom == null || evaluatedTo == null) {
      setError(t("transfer.errors.amount_expr"));
      return;
    }
    const normalizedFrom = Number(roundMoneyAmount(evaluatedFrom).toFixed(2));
    const normalizedTo = Number(roundMoneyAmount(evaluatedTo).toFixed(2));
    const adjustments = [] as { accountId: string; currencyId: string; delta: number }[];

    try {
      if (editingTx?.id) {
        const prevAmountFrom = Number(editingTx.amountFrom ?? 0);
        const prevAmountTo = Number(editingTx.amountTo ?? 0);
        if (editingTx.accountId && editingTx.fromCurrencyId && prevAmountFrom) {
          adjustments.push({ accountId: editingTx.accountId, currencyId: editingTx.fromCurrencyId, delta: prevAmountFrom });
        }
        if (editingTx.accountId && editingTx.toCurrencyId && prevAmountTo) {
          adjustments.push({ accountId: editingTx.accountId, currencyId: editingTx.toCurrencyId, delta: -prevAmountTo });
        }
        await updateDoc(doc(db, Collections.Transactions, editingTx.id), {
          accountId,
          fromCurrencyId,
          toCurrencyId,
          amountFrom: normalizedFrom,
          amountTo: normalizedTo,
          comment: comment || null,
          date,
        } as any);
      } else {
        await addDoc(collection(db, Collections.Transactions), {
          type: "exchange",
          accountId,
          fromCurrencyId,
          toCurrencyId,
          amountFrom: normalizedFrom,
          amountTo: normalizedTo,
          comment: comment || null,
          date,
          ownerUid,
          createdAt: serverTimestamp(),
        });
      }

      adjustments.push({ accountId, currencyId: fromCurrencyId, delta: -normalizedFrom });
      adjustments.push({ accountId, currencyId: toCurrencyId, delta: normalizedTo });
      await applyBalanceAdjustments(ownerUid, adjustments);

      setAmountFrom("");
      setAmountTo("");
      setComment("");
      setError(null);
      onDone?.();
    } catch (err) {
      console.error("Failed to save exchange transaction", err);
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
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid gap-1">
          <Label htmlFor={accSelId}>{t("nav.accounts")}</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger id={accSelId} className="font-semibold sm:w-56">
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
        <div className="grid gap-1 md:w-auto">
          <Label htmlFor={dateId}>{t("common.date")}</Label>
          <DatePicker value={date} onChange={setDate} triggerId={dateId} triggerClassName="w-full sm:w-auto" />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="grid gap-1">
          <Label htmlFor={fromCurSelId}>{t("exchange.sold_currency")}</Label>
          <Select value={fromCurrencyId} onValueChange={(value) => {
            setFromCurrencyId(value);
            setError((prev) => (prev === sameCurrencyError && value !== toCurrencyId ? null : prev));
          }}>
            <SelectTrigger id={fromCurSelId} className="w-full sm:w-44">
              <SelectValue placeholder={t("common.choose")} />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{currencyName(c.id)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor={fromAmtId}>{t("exchange.sold_amount")}</Label>
          <div className="relative">
            <Input
              id={fromAmtId}
              className={cn("w-full sm:w-56", amountFromPreview ? "pr-16" : undefined)}
              type="text"
              placeholder="0.0"
              value={amountFrom}
              onChange={handleAmountFromChange}
            />
            {amountFromPreview ? (
              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">
                {amountFromPreview}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="grid gap-1">
          <Label htmlFor={toCurSelId}>{t("exchange.bought_currency")}</Label>
          <Select value={toCurrencyId} onValueChange={(value) => {
            setToCurrencyId(value);
            setError((prev) => (prev === sameCurrencyError && value !== fromCurrencyId ? null : prev));
          }}>
            <SelectTrigger id={toCurSelId} className="w-full sm:w-44">
              <SelectValue placeholder={t("common.choose")} />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{currencyName(c.id)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor={toAmtId}>{t("exchange.bought_amount")}</Label>
          <div className="relative">
            <Input
              id={toAmtId}
              className={cn("w-full sm:w-56", amountToPreview ? "pr-16" : undefined)}
              type="text"
              placeholder="0.0"
              value={amountTo}
              onChange={handleAmountToChange}
            />
            {amountToPreview ? (
              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">
                {amountToPreview}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-0 flex-1 gap-1">
          <Label htmlFor={commentId}>{t("common.comment")}</Label>
          <Input id={commentId} placeholder={t("common.optional")} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      <div className="flex justify-end gap-2 pt-1">
        {editingTx ? (
          <Button variant="ghost" onClick={() => onDone?.()}>{t("common.cancel")}</Button>
        ) : null}
        <Button onClick={submit}>{submitLabel}</Button>
      </div>
    </div>
  );
}
