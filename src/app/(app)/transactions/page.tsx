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

type Account = { id: string; name: string };
type Currency = { id: string; name: string };
type Category = { id: string; name: string; parentId?: string | null };
type Source = { id: string; name: string; parentId?: string | null };

export default function TransactionsPage() {
  const { ownerUid } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sources, setSources] = useState<Source[]>([]);

  useEffect(() => {
    if (!ownerUid) {
      return;
    }
    const unsubAccounts = onSnapshot(
      query(collection(db, Collections.Accounts), where("ownerUid", "==", ownerUid), orderBy("name")),
      (snap) => setAccounts(snap.docs.map((d) => ({ id: d.id, name: (d.data() as any).name })))
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
          <ExpenseForm accounts={accounts} currencies={currencies} categories={categories} />
        </TabsContent>
        <TabsContent value="income">
          <IncomeForm accounts={accounts} sources={sources} />
        </TabsContent>
        <TabsContent value="transfer">
          <TransferForm accounts={accounts} />
        </TabsContent>
        <TabsContent value="exchange">
          <ExchangeForm accounts={accounts} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

