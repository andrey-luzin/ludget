"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!ownerUid) {
      return;
    }
    const unsubAccounts = onSnapshot(
      query(collection(db, Collections.Accounts), where("ownerUid", "==", ownerUid), orderBy("name")),
      (snap) => setAccounts(
        snap.docs.map((d) => {
          const data = d.data() as any;
          return { id: d.id, name: data.name, color: data.color, iconUrl: data.iconUrl } as Account;
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
          <ExpenseForm accounts={accounts} currencies={currencies} categories={categories} editingTx={editingExpense} onDone={() => setEditingExpense(null)} />
          <TransactionsList type="expense" accounts={accounts} currencies={currencies} categories={categories} onEdit={setEditingExpense} />
        </TabsContent>
        <TabsContent value="income">
          <h2 className="text-lg font-medium mb-3">Доход</h2>
          <IncomeForm accounts={accounts} sources={sources} currencies={currencies} editingTx={editingIncome} onDone={() => setEditingIncome(null)} />
          <TransactionsList type="income" accounts={accounts} currencies={currencies} sources={sources} onEdit={setEditingIncome} />
        </TabsContent>
        <TabsContent value="transfer">
          <h2 className="text-lg font-medium mb-3">Перемещение</h2>
          <TransferForm accounts={accounts} editingTx={editingTransfer} onDone={() => setEditingTransfer(null)} />
          <TransactionsList type="transfer" accounts={accounts} currencies={currencies} onEdit={setEditingTransfer} />
        </TabsContent>
        <TabsContent value="exchange">
          <h2 className="text-lg font-medium mb-3">Обмен валют</h2>
          <ExchangeForm accounts={accounts} currencies={currencies} editingTx={editingExchange} onDone={() => setEditingExchange(null)} />
          <TransactionsList type="exchange" accounts={accounts} currencies={currencies} onEdit={setEditingExchange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
