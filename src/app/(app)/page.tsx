"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Collections } from "@/types/collections";
import { collection, doc, onSnapshot, orderBy, query, where, writeBatch } from "firebase/firestore";
import { ExpenseForm } from "@/components/transactions/expense-form";
import { IncomeForm } from "@/components/transactions/income-form";
import { TransferForm } from "@/components/transactions/transfer-form";
import { ExchangeForm } from "@/components/transactions/exchange-form";
import { TransactionsList } from "@/components/transactions/transactions-list";
import type { Account, Category, Currency, Source } from "@/types/entities";
import { useI18n } from "@/contexts/i18n-context";

const MAX_ORDER_VALUE = Number.MAX_SAFE_INTEGER;

function compareCategories(a: Category, b: Category) {
  const orderA = a.order ?? MAX_ORDER_VALUE;
  const orderB = b.order ?? MAX_ORDER_VALUE;
  if (orderA !== orderB) {
    return orderA - orderB;
  }
  return a.name.localeCompare(b.name, "ru", { sensitivity: "base" });
}

function compareSources(a: Source, b: Source) {
  const orderA = a.order ?? MAX_ORDER_VALUE;
  const orderB = b.order ?? MAX_ORDER_VALUE;
  if (orderA !== orderB) {
    return orderA - orderB;
  }
  return a.name.localeCompare(b.name, "ru", { sensitivity: "base" });
}

export default function TransactionsPage() {
  const { t } = useI18n();
  const { ownerUid } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [editingIncome, setEditingIncome] = useState<any | null>(null);
  const [editingTransfer, setEditingTransfer] = useState<any | null>(null);
  const [editingExchange, setEditingExchange] = useState<any | null>(null);
  const expenseFormRef = useRef<HTMLDivElement | null>(null);
  const incomeFormRef = useRef<HTMLDivElement | null>(null);
  const transferFormRef = useRef<HTMLDivElement | null>(null);
  const exchangeFormRef = useRef<HTMLDivElement | null>(null);

  const ensureAccountsOrder = useCallback(async (items: Account[]) => {
    const batch = writeBatch(db);
    items.forEach((account, index) => {
      batch.update(doc(db, Collections.Accounts, account.id), { order: index } as any);
    });
    try {
      await batch.commit();
    } catch (err) {
      console.error("Failed to ensure accounts order", err);
    }
  }, []);

  const ensureCurrenciesOrder = useCallback(async (items: Currency[]) => {
    const batch = writeBatch(db);
    items.forEach((currency, index) => {
      batch.update(doc(db, Collections.Currencies, currency.id), { order: index } as any);
    });
    try {
      await batch.commit();
    } catch (err) {
      console.error("Failed to ensure currencies order", err);
    }
  }, []);

  const ensureCategoriesOrder = useCallback(async (rootItems: Category[]) => {
    if (!rootItems.length) {
      return;
    }
    const batch = writeBatch(db);
    rootItems.forEach((category, index) => {
      batch.update(doc(db, Collections.Categories, category.id), { order: index } as any);
    });
    try {
      await batch.commit();
    } catch (err) {
      console.error("Failed to ensure categories order", err);
    }
  }, []);

  const ensureSourcesOrder = useCallback(async (rootItems: Source[]) => {
    if (!rootItems.length) {
      return;
    }
    const batch = writeBatch(db);
    rootItems.forEach((source, index) => {
      batch.update(doc(db, Collections.IncomeSources, source.id), { order: index } as any);
    });
    try {
      await batch.commit();
    } catch (err) {
      console.error("Failed to ensure income sources order", err);
    }
  }, []);

  const scrollToForm = (ref: RefObject<HTMLDivElement | null>) => {
    if (!ref.current) {
      return;
    }
    ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleEditExpense = (tx: any) => {
    setEditingExpense(tx);
    scrollToForm(expenseFormRef);
  };

  const handleEditIncome = (tx: any) => {
    setEditingIncome(tx);
    scrollToForm(incomeFormRef);
  };

  const handleEditTransfer = (tx: any) => {
    setEditingTransfer(tx);
    scrollToForm(transferFormRef);
  };

  const handleEditExchange = (tx: any) => {
    setEditingExchange(tx);
    scrollToForm(exchangeFormRef);
  };

  useEffect(() => {
    if (!ownerUid) {
      return;
    }
    const unsubAccounts = onSnapshot(
      query(collection(db, Collections.Accounts), where("ownerUid", "==", ownerUid), orderBy("name")),
      (snap) => {
        const mapped = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name,
            color: data.color,
            iconUrl: data.iconUrl,
            createdBy: data.createdBy,
            order: typeof data.order === "number" ? data.order : undefined,
          } as Account;
        });
        const sorted = [...mapped].sort((a, b) => {
          const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
          const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) return orderA - orderB;
          return a.name.localeCompare(b.name, "ru", { sensitivity: "base" });
        });
        setAccounts(sorted);
        const missingOrder = mapped.some((account) => account.order == null);
        if (missingOrder) {
          void ensureAccountsOrder(sorted.map((account, idx) => ({ ...account, order: idx })));
        }
      }
    );
    const unsubCurrencies = onSnapshot(
      query(collection(db, Collections.Currencies), where("ownerUid", "==", ownerUid), orderBy("name")),
      (snap) => {
        const mapped = snap.docs.map((d) => {
          const data = d.data() as any;
          return { id: d.id, name: data.name, order: typeof data.order === "number" ? data.order : undefined } as Currency;
        });
        const sorted = [...mapped].sort((a, b) => {
          const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
          const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) return orderA - orderB;
          return a.name.localeCompare(b.name, "ru", { sensitivity: "base" });
        });
        setCurrencies(sorted);
        const missingOrder = mapped.some((currency) => currency.order == null);
        if (missingOrder) {
          void ensureCurrenciesOrder(sorted.map((currency, idx) => ({ ...currency, order: idx })));
        }
      }
    );
    const unsubCategories = onSnapshot(
      query(collection(db, Collections.Categories), where("ownerUid", "==", ownerUid), orderBy("name")),
      (snap) => {
        const mapped = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name,
            parentId: data.parentId ?? null,
            order: typeof data.order === "number" ? data.order : undefined,
          } as Category;
        });
        const rootCategories = mapped.filter((category) => !category.parentId);
        const missingRootOrder = rootCategories.some((category) => category.order == null);
        if (missingRootOrder) {
          const normalized = [...rootCategories]
            .sort(compareCategories)
            .map((category, index) => ({ ...category, order: index }));
          void ensureCategoriesOrder(normalized);
        }
        setCategories(mapped.sort(compareCategories));
      }
    );
    const unsubSources = onSnapshot(
      query(collection(db, Collections.IncomeSources), where("ownerUid", "==", ownerUid), orderBy("name")),
      (snap) => {
        const mapped = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name,
            parentId: data.parentId ?? null,
            order: typeof data.order === "number" ? data.order : undefined,
          } as Source;
        });
        const rootSources = mapped.filter((source) => !source.parentId);
        const missingRootOrder = rootSources.some((source) => source.order == null);
        if (missingRootOrder) {
          const normalized = [...rootSources]
            .sort(compareSources)
            .map((source, index) => ({ ...source, order: index }));
          void ensureSourcesOrder(normalized);
        }
        setSources(mapped.sort(compareSources));
      }
    );

    return () => { unsubAccounts(); unsubCurrencies(); unsubCategories(); unsubSources(); };
  }, [ownerUid, ensureAccountsOrder, ensureCurrenciesOrder, ensureCategoriesOrder, ensureSourcesOrder]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">{t("app.transactions.title")}</h1>
      <Tabs defaultValue="expense" className="mt-4">
        <TabsList>
          <TabsTrigger value="expense">{t("app.tabs.expense")}</TabsTrigger>
          <TabsTrigger value="income">{t("app.tabs.income")}</TabsTrigger>
          <TabsTrigger value="transfer">{t("app.tabs.transfer")}</TabsTrigger>
          <TabsTrigger value="exchange">{t("app.tabs.exchange")}</TabsTrigger>
        </TabsList>

        <TabsContent value="expense">
          <h2 className="text-lg font-medium mb-3">{t("app.tabs.expense")}</h2>
          <div ref={expenseFormRef}>
            <ExpenseForm accounts={accounts} currencies={currencies} categories={categories} editingTx={editingExpense} onDone={() => setEditingExpense(null)} />
          </div>
          <TransactionsList
            type="expense"
            accounts={accounts}
            currencies={currencies}
            categories={categories}
            onEdit={handleEditExpense}
            editingId={editingExpense?.id ?? null}
          />
        </TabsContent>
        <TabsContent value="income">
          <h2 className="text-lg font-medium mb-3">{t("app.tabs.income")}</h2>
          <div ref={incomeFormRef}>
            <IncomeForm accounts={accounts} sources={sources} currencies={currencies} editingTx={editingIncome} onDone={() => setEditingIncome(null)} />
          </div>
          <TransactionsList
            type="income"
            accounts={accounts}
            currencies={currencies}
            sources={sources}
            onEdit={handleEditIncome}
            editingId={editingIncome?.id ?? null}
          />
        </TabsContent>
        <TabsContent value="transfer">
          <h2 className="text-lg font-medium mb-3">{t("app.tabs.transfer")}</h2>
          <div ref={transferFormRef}>
            <TransferForm
              accounts={accounts}
              currencies={currencies}
              editingTx={editingTransfer}
              onDone={() => setEditingTransfer(null)}
            />
          </div>
          <TransactionsList
            type="transfer"
            accounts={accounts}
            currencies={currencies}
            onEdit={handleEditTransfer}
            editingId={editingTransfer?.id ?? null}
          />
        </TabsContent>
        <TabsContent value="exchange">
          <h2 className="text-lg font-medium mb-3">{t("app.tabs.exchange")}</h2>
          <div ref={exchangeFormRef}>
            <ExchangeForm accounts={accounts} currencies={currencies} editingTx={editingExchange} onDone={() => setEditingExchange(null)} />
          </div>
          <TransactionsList
            type="exchange"
            accounts={accounts}
            currencies={currencies}
            onEdit={handleEditExchange}
            editingId={editingExchange?.id ?? null}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
