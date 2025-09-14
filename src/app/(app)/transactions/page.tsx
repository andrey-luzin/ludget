"use client";

import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Alert } from "@/components/ui/alert";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Collections, SubCollections } from "@/types/collections";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, where, doc, getDocs } from "firebase/firestore";

type Account = { id: string; name: string };
type Balance = { id: string; currencyId: string; amount: number };
type Currency = { id: string; name: string };
type Category = { id: string; name: string; parentId?: string | null };
type Source = { id: string; name: string; parentId?: string | null };

export default function TransactionsPage() {
  const { ownerUid } = useAuth();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [balances, setBalances] = useState<Record<string, Balance[]>>({});

  useEffect(() => {
    if (!ownerUid) return;
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

  useEffect(() => {
    if (!ownerUid) return;
    // Preload balances per account
    (async () => {
      const map: Record<string, Balance[]> = {};
      for (const acc of accounts) {
        const snap = await getDocs(query(collection(db, Collections.Accounts, acc.id, SubCollections.Balances), where("ownerUid", "==", ownerUid)));
        map[acc.id] = snap.docs.map((d) => {
          const data = d.data() as any;
          return { id: d.id, currencyId: String(data.currencyId), amount: Number(data.amount) } as Balance;
        });
      }
      setBalances(map);
    })();
  }, [accounts, ownerUid]);

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
          <ExpenseForm accounts={accounts} currencies={currencies} balances={balances} categories={categories} />
        </TabsContent>
        <TabsContent value="income">
          <IncomeForm accounts={accounts} currencies={currencies} balances={balances} sources={sources} />
        </TabsContent>
        <TabsContent value="transfer">
          <TransferForm accounts={accounts} balances={balances} />
        </TabsContent>
        <TabsContent value="exchange">
          <ExchangeForm accounts={accounts} currencies={currencies} balances={balances} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DatePicker({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button variant="outline" onClick={() => setOpen((o) => !o)}>{value.toLocaleDateString()}</Button>
      {open ? (
        <div className="mt-2 border rounded-md p-2 inline-block">
          <Calendar mode="single" selected={value} onSelect={(d) => d && (onChange(d), setOpen(false))} />
        </div>
      ) : null}
    </div>
  );
}

function ExpenseForm({ accounts, currencies, balances, categories }: {
  accounts: Account[];
  currencies: Currency[];
  balances: Record<string, Balance[]>;
  categories: Category[];
}) {
  const { ownerUid } = useAuth();
  const [accountId, setAccountId] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [date, setDate] = useState(new Date());
  const [error, setError] = useState<string | null>(null);

  const accountBalances = balances[accountId] || [];

  useEffect(() => {
    if (accountId && !accountBalances.find((b) => b.currencyId === currencyId)) {
      setCurrencyId(accountBalances[0]?.currencyId || "");
    }
  }, [accountId]);

  async function submit() {
    if (!accountId || !currencyId || !categoryId || !amount.trim()) {
      setError("Заполните обязательные поля.");
      return;
    }
    await addDoc(collection(db, Collections.Transactions), {
      type: "expense",
      accountId,
      currencyId,
      categoryId,
      amount: Number(amount),
      comment: comment || null,
      date: date,
      ownerUid,
      createdAt: serverTimestamp(),
    });
    setAmount("");
    setComment("");
    setError(null);
  }

  const allCategories = useMemo(() => categories, [categories]);

  return (
    <div className="grid gap-3">
      <div className="flex gap-2 items-center">
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Счет" /></SelectTrigger>
          <SelectContent>
            {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={currencyId} onValueChange={setCurrencyId}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Валюта" /></SelectTrigger>
          <SelectContent>
            {accountBalances.map((b) => <SelectItem key={b.id} value={b.currencyId}>{b.currencyId}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Категория" /></SelectTrigger>
          <SelectContent>
            {allCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Input className="w-40" type="number" placeholder="Сумма" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input className="flex-1 min-w-56" placeholder="Комментарий (опционально)" value={comment} onChange={(e) => setComment(e.target.value)} />
        <DatePicker value={date} onChange={setDate} />
        <Button onClick={submit}>Сохранить</Button>
      </div>
      {error ? <Alert>{error}</Alert> : null}
    </div>
  );
}

function IncomeForm({ accounts, currencies, balances, sources }: {
  accounts: Account[];
  currencies: Currency[];
  balances: Record<string, Balance[]>;
  sources: Source[];
}) {
  const { ownerUid } = useAuth();
  const [accountId, setAccountId] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [date, setDate] = useState(new Date());
  const [error, setError] = useState<string | null>(null);

  const accountBalances = balances[accountId] || [];

  useEffect(() => {
    if (accountId && !accountBalances.find((b) => b.currencyId === currencyId)) {
      setCurrencyId(accountBalances[0]?.currencyId || "");
    }
  }, [accountId]);

  async function submit() {
    if (!accountId || !currencyId || !sourceId || !amount.trim()) {
      setError("Заполните обязательные поля.");
      return;
    }
    await addDoc(collection(db, Collections.Transactions), {
      type: "income",
      accountId,
      currencyId,
      sourceId,
      amount: Number(amount),
      comment: comment || null,
      date: date,
      ownerUid,
      createdAt: serverTimestamp(),
    });
    setAmount("");
    setComment("");
    setError(null);
  }

  return (
    <div className="grid gap-3">
      <div className="flex gap-2 items-center">
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Счет" /></SelectTrigger>
          <SelectContent>
            {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={currencyId} onValueChange={setCurrencyId}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Валюта" /></SelectTrigger>
          <SelectContent>
            {accountBalances.map((b) => <SelectItem key={b.id} value={b.currencyId}>{b.currencyId}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sourceId} onValueChange={setSourceId}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Источник" /></SelectTrigger>
          <SelectContent>
            {sources.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Input className="w-40" type="number" placeholder="Сумма" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input className="flex-1 min-w-56" placeholder="Комментарий (опционально)" value={comment} onChange={(e) => setComment(e.target.value)} />
        <DatePicker value={date} onChange={setDate} />
        <Button onClick={submit}>Сохранить</Button>
      </div>
      {error ? <Alert>{error}</Alert> : null}
    </div>
  );
}

function TransferForm({ accounts, balances }: { accounts: Account[]; balances: Record<string, Balance[]>; }) {
  const { ownerUid } = useAuth();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [date, setDate] = useState(new Date());
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!fromId || !toId || !amount.trim()) {
      setError("Заполните обязательные поля.");
      return;
    }
    await addDoc(collection(db, Collections.Transactions), {
      type: "transfer",
      fromAccountId: fromId,
      toAccountId: toId,
      amount: Number(amount),
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
      <div className="flex gap-2 items-center">
        <Select value={fromId} onValueChange={setFromId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Счет откуда" /></SelectTrigger>
          <SelectContent>
            {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={toId} onValueChange={setToId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Счет куда" /></SelectTrigger>
          <SelectContent>
            {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Input className="w-40" type="number" placeholder="Сумма" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input className="flex-1 min-w-56" placeholder="Комментарий (опционально)" value={comment} onChange={(e) => setComment(e.target.value)} />
        <DatePicker value={date} onChange={setDate} />
        <Button onClick={submit}>Сохранить</Button>
      </div>
      {error ? <Alert>{error}</Alert> : null}
    </div>
  );
}

function ExchangeForm({ accounts, currencies, balances }: { accounts: Account[]; currencies: Currency[]; balances: Record<string, Balance[]>; }) {
  const { ownerUid } = useAuth();
  const [accountId, setAccountId] = useState("");
  const [fromCurrencyId, setFromCurrencyId] = useState("");
  const [toCurrencyId, setToCurrencyId] = useState("");
  const [amountFrom, setAmountFrom] = useState("");
  const [amountTo, setAmountTo] = useState("");
  const [comment, setComment] = useState("");
  const [date, setDate] = useState(new Date());
  const [error, setError] = useState<string | null>(null);

  const accountBalances = balances[accountId] || [];

  useEffect(() => {
    if (accountId) {
      if (!accountBalances.find((b) => b.currencyId === fromCurrencyId)) setFromCurrencyId(accountBalances[0]?.currencyId || "");
      if (!accountBalances.find((b) => b.currencyId === toCurrencyId)) setToCurrencyId(accountBalances[0]?.currencyId || "");
    }
  }, [accountId]);

  async function submit() {
    if (!accountId || !fromCurrencyId || !toCurrencyId || !amountFrom.trim() || !amountTo.trim()) {
      setError("Заполните обязательные поля.");
      return;
    }
    await addDoc(collection(db, Collections.Transactions), {
      type: "exchange",
      accountId,
      fromCurrencyId,
      toCurrencyId,
      amountFrom: Number(amountFrom),
      amountTo: Number(amountTo),
      comment: comment || null,
      date,
      ownerUid,
      createdAt: serverTimestamp(),
    });
    setAmountFrom("");
    setAmountTo("");
    setComment("");
    setError(null);
  }

  return (
    <div className="grid gap-3">
      <div className="flex gap-2 items-center">
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Счет" /></SelectTrigger>
          <SelectContent>
            {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={fromCurrencyId} onValueChange={setFromCurrencyId}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Продали (валюта)" /></SelectTrigger>
          <SelectContent>
            {accountBalances.map((b) => <SelectItem key={b.id} value={b.currencyId}>{b.currencyId}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input className="w-40" type="number" placeholder="Сколько продали" value={amountFrom} onChange={(e) => setAmountFrom(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={toCurrencyId} onValueChange={setToCurrencyId}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Купили (валюта)" /></SelectTrigger>
          <SelectContent>
            {accountBalances.map((b) => <SelectItem key={b.id} value={b.currencyId}>{b.currencyId}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input className="w-40" type="number" placeholder="Сколько купили" value={amountTo} onChange={(e) => setAmountTo(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Input className="flex-1 min-w-56" placeholder="Комментарий (опционально)" value={comment} onChange={(e) => setComment(e.target.value)} />
        <DatePicker value={date} onChange={setDate} />
        <Button onClick={submit}>Сохранить</Button>
      </div>
      {error ? <Alert>{error}</Alert> : null}
    </div>
  );
}

