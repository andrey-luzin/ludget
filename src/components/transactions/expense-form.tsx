"use client";

import { useEffect, useMemo, useState, useId } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { DatePicker } from "@/components/date-picker";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/contexts/i18n-context";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Collections } from "@/types/collections";
import { applyBalanceAdjustments } from "@/lib/account-balances";
import { addDoc, collection, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { evaluateAmountExpression, sanitizeMoneyInput, roundMoneyAmount, getAmountPreview } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Account, Category, Currency } from "@/types/entities";

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
  const [currencyId, setCurrencyId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [date, setDate] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const currencyName = (id: string) => currencies.find((c) => c.id === id)?.name ?? id;
  const { t } = useI18n();
  const submitLabel = editingTx ? t("transfer.submit.save") : t("transfer.submit.add");
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
    if (!accountId || !currencyId || !categoryId || !amount.trim()) {
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
        const prevAmount = Number(editingTx.amount ?? 0);
        if (editingTx.accountId && editingTx.currencyId && prevAmount) {
          adjustments.push({ accountId: editingTx.accountId, currencyId: editingTx.currencyId, delta: prevAmount });
        }
        await updateDoc(doc(db, Collections.Transactions, editingTx.id), {
          accountId,
          currencyId,
          categoryId,
          amount: normalizedAmount,
          comment: comment || null,
          date,
        } as any);
      } else {
        await addDoc(collection(db, Collections.Transactions), {
          type: "expense",
          accountId,
          currencyId,
          categoryId,
          amount: normalizedAmount,
          comment: comment || null,
          date,
          ownerUid,
          createdAt: serverTimestamp(),
        });
      }

      adjustments.push({ accountId, currencyId, delta: -normalizedAmount });
      await applyBalanceAdjustments(ownerUid, adjustments);

      setAmount("");
      setComment("");
      setError(null);
      onDone?.();
    } catch (err) {
      console.error("Failed to save expense transaction", err);
      setError(t("transfer.errors.save_failed"));
    }
  }

  const compareCategoryOrder = (a: Category, b: Category) => {
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.name.localeCompare(b.name, "ru", { sensitivity: "base" });
  };

  const categoryOptions = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c] as const));
    const grouped = new Map<string | null, Category[]>();
    for (const category of categories) {
      const parentKey = category.parentId && byId.has(category.parentId) ? category.parentId : null;
      const list = grouped.get(parentKey) ?? [];
      list.push(category);
      grouped.set(parentKey, list);
    }
    const sortCategories = (arr: Category[]) => [...arr].sort(compareCategoryOrder);

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

  function handleMetaEnterSubmit(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      submit();
    }
  }

  return (
    <div className="grid gap-4" onKeyDownCapture={handleMetaEnterSubmit}>
      <div className="flex gap-3 flex-wrap sm:items-end">
        <div className="grid gap-1 max-sm:grow">
          <Label htmlFor={accSelId}>{t("nav.accounts")}</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger id={accSelId} className="font-semibold sm:w-64">
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
        <div className="flex gap-3 grow">
          <div className="grid gap-1 grow">
            <Label htmlFor={amountId}>{t("common.amount")}</Label>
            <div className="relative">
              <Input
                id={amountId}
                className={cn("w-full", amountPreview ? "pr-16" : undefined)}
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
                <SelectValue placeholder={t("common.choose")} />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{currencyName(c.id)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="grid gap-1">
          <Label htmlFor={categorySelId}>{t("nav.categories")}</Label>
          <Combobox
            id={categorySelId}
            value={categoryId}
            onChange={setCategoryId}
            options={categoryOptions}
            placeholder={t("common.choose")}
            searchPlaceholder={t("stats.search")}
            triggerClassName="w-full justify-between sm:w-64"
          />
        </div>
        <div className="grid min-w-0 flex-1 gap-1">
          <Label htmlFor={commentId}>{t("common.comment")}</Label>
          <Input id={commentId} placeholder={t("common.optional")} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      <div className="flex justify-between items-end gap-2 pt-1">
        <div className="grid gap-1 md:w-auto mr-auto">
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
