"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Collections } from "@/types/collections";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { ExpenseForm } from "@/components/transactions/expense-form";
import { IncomeForm } from "@/components/transactions/income-form";
import { TransferForm } from "@/components/transactions/transfer-form";
import { ExchangeForm } from "@/components/transactions/exchange-form";
import { TransactionsList } from "@/components/transactions/transactions-list";
import type { Account, Category, Currency, Source } from "@/types/entities";

export default function TransactionsPage() {
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
      (snap) => setAccounts(
        snap.docs.map((d) => {
          const data = d.data() as any;
          return { id: d.id, name: data.name, color: data.color, iconUrl: data.iconUrl, createdBy: data.createdBy } as Account;
        })
      )
    );
    const unsubCurrencies = onSnapshot(
      query(collection(db, Collections.Currencies), where("ownerUid", "==", ownerUid), orderBy("name")),
      (snap) => setCurrencies(snap.docs.map((d) => ({ id: d.id, name: (d.data() as any).name })))
    );
    const unsubCategories = onSnapshot(
      query(collection(db, Collections.Categories), where("ownerUid", "==", ownerUid), orderBy("name")),
      (snap) => setCategories(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as Category[]).flat())
    );
    const unsubSources = onSnapshot(
      query(collection(db, Collections.IncomeSources), where("ownerUid", "==", ownerUid), orderBy("name")),
      (snap) => setSources(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as Source[]).flat())
    );

    return () => { unsubAccounts(); unsubCurrencies(); unsubCategories(); unsubSources(); };
  }, [ownerUid]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Транзакции</h1>
      <Tabs defaultValue="expense" className="mt-4">
        <TabsList>
          <TabsTrigger value="expense">Расход</TabsTrigger>
          <TabsTrigger value="income">Доход</TabsTrigger>
          <TabsTrigger value="transfer">Перемещение</TabsTrigger>
          <TabsTrigger value="exchange">Обмен валют</TabsTrigger>
        </TabsList>

        <TabsContent value="expense">
          <h2 className="text-lg font-medium mb-3">Расход</h2>
          <div ref={expenseFormRef}>
            <ExpenseForm accounts={accounts} currencies={currencies} categories={categories} editingTx={editingExpense} onDone={() => setEditingExpense(null)} />
          </div>
          <TransactionsList type="expense" accounts={accounts} currencies={currencies} categories={categories} onEdit={handleEditExpense} />
        </TabsContent>
        <TabsContent value="income">
          <h2 className="text-lg font-medium mb-3">Доход</h2>
          <div ref={incomeFormRef}>
            <IncomeForm accounts={accounts} sources={sources} currencies={currencies} editingTx={editingIncome} onDone={() => setEditingIncome(null)} />
          </div>
          <TransactionsList type="income" accounts={accounts} currencies={currencies} sources={sources} onEdit={handleEditIncome} />
        </TabsContent>
        <TabsContent value="transfer">
          <h2 className="text-lg font-medium mb-3">Перемещение</h2>
          <div ref={transferFormRef}>
            <TransferForm accounts={accounts} editingTx={editingTransfer} onDone={() => setEditingTransfer(null)} />
          </div>
          <TransactionsList type="transfer" accounts={accounts} currencies={currencies} onEdit={handleEditTransfer} />
        </TabsContent>
        <TabsContent value="exchange">
          <h2 className="text-lg font-medium mb-3">Обмен валют</h2>
          <div ref={exchangeFormRef}>
            <ExchangeForm accounts={accounts} currencies={currencies} editingTx={editingExchange} onDone={() => setEditingExchange(null)} />
          </div>
          <TransactionsList type="exchange" accounts={accounts} currencies={currencies} onEdit={handleEditExchange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
