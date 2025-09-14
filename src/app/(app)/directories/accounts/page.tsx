"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  getDocs,
} from "firebase/firestore";
import { Collections, SubCollections } from "@/types/collections";

type Currency = { id: string; name: string };
type Balance = { id: string; currencyId: string; amount: number };
type Account = { id: string; name: string };

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [confirmAccount, setConfirmAccount] = useState<Account | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [pendingAdd, setPendingAdd] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, Collections.Accounts), orderBy("name")), (snap) => {
      setAccounts(snap.docs.map((d) => ({ id: d.id, name: (d.data() as any).name })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, Collections.Currencies), orderBy("name")), (snap) => {
      setCurrencies(snap.docs.map((d) => ({ id: d.id, name: (d.data() as any).name })));
    });
    return () => unsub();
  }, []);

  async function addAccount() {
    if (!newName.trim()) return;
    setPendingAdd(true);
    try {
      await addDoc(collection(db, Collections.Accounts), { name: newName.trim(), createdAt: serverTimestamp() });
      setNewName("");
    } finally {
      setPendingAdd(false);
    }
  }

  async function saveEdit(id: string) {
    const name = editing[id]?.trim();
    if (!name) return;
    await updateDoc(doc(db, Collections.Accounts, id), { name });
    setEditing((s) => ({ ...s, [id]: "" }));
  }

  async function deleteAccount(acc: Account) {
    // Delete balances subcollection docs first
    const balancesCol = collection(db, Collections.Accounts, acc.id, SubCollections.Balances);
    const snap = await getDocs(balancesCol);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(doc(db, Collections.Accounts, acc.id));
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Счета</h1>
      <p className="text-muted-foreground mt-1">Управляйте счетами и их валютами.</p>

      <div className="mt-6 flex gap-2">
        <Input
          placeholder="Название счета"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button onClick={addAccount} loading={pendingAdd}>Добавить</Button>
      </div>

      <div className="mt-6 grid gap-3">
        {accounts.map((acc) => (
          <AccountItem
            key={acc.id}
            account={acc}
            currencies={currencies}
            editingName={editing[acc.id]}
            setEditingName={(name) => setEditing((s) => ({ ...s, [acc.id]: name }))}
            onSave={() => saveEdit(acc.id)}
            onAskDelete={() => setConfirmAccount(acc)}
          />
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(confirmAccount)}
        title="Удалить счет?"
        description={confirmAccount ? `Счет "${confirmAccount.name}" будет удален вместе с валютами.` : undefined}
        onConfirm={() => (confirmAccount ? deleteAccount(confirmAccount) : undefined)}
        onOpenChange={(o) => !o && setConfirmAccount(null)}
      />
    </div>
  );
}

function AccountItem({
  account,
  currencies,
  editingName,
  setEditingName,
  onSave,
  onAskDelete,
}: {
  account: Account;
  currencies: Currency[];
  editingName?: string;
  setEditingName: (name: string) => void;
  onSave: () => void;
  onAskDelete: () => void;
}) {
  const [serverBalances, setServerBalances] = useState<Balance[]>([]);
  const [drafts, setDrafts] = useState<{ id: string; currencyId: string; amount: string; isNew?: boolean; deleted?: boolean }[]>([]);
  const [adding, setAdding] = useState<{ currencyId: string; amount: string }>({ currencyId: "", amount: "0" });
  const [addError, setAddError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, Collections.Accounts, account.id, SubCollections.Balances), (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data() as any;
        return { id: d.id, currencyId: String(data.currencyId), amount: Number(data.amount) } as Balance;
      });
      setServerBalances(list);
      setDrafts(list.map((b) => ({ id: b.id, currencyId: b.currencyId, amount: String(b.amount) })));
    });
    return () => unsub();
  }, [account.id]);

  async function addBalance() {
    const currencyId = adding.currencyId;
    const amount = Number(adding.amount || 0);
    if (!currencyId) {
      setAddError("Пожалуйста, выберите валюту перед добавлением.");
      return;
    }
    setDrafts((ds) => [
      ...ds,
      { id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, currencyId, amount: String(amount), isNew: true },
    ]);
    setAdding({ currencyId: "", amount: "0" });
    setAddError(null);
  }

  function updateDraft(id: string, patch: Partial<{ currencyId: string; amount: string }>) {
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function markDelete(id: string) {
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, deleted: true } : d)));
  }

  function currencyLabel(id: string) {
    return currencies.find((c) => c.id === id)?.name ?? "—";
  }

  const visibleDrafts = drafts.filter((d) => !d.deleted);
  const hasDuplicates = (() => {
    const map = new Map<string, number>();
    for (const d of visibleDrafts) {
      if (!d.currencyId) continue;
      map.set(d.currencyId, (map.get(d.currencyId) || 0) + 1);
    }
    for (const [, cnt] of map) if (cnt > 1) return true;
    return false;
  })();

  const isDirty = (() => {
    if (drafts.some((d) => d.isNew || d.deleted)) return true;
    const byId = new Map(serverBalances.map((b) => [b.id, b] as const));
    for (const d of drafts) {
      if (d.isNew || d.deleted) continue;
      const s = byId.get(d.id);
      if (!s) return true;
      if (s.currencyId !== d.currencyId) return true;
      if (String(s.amount) !== String(d.amount)) return true;
    }
    return false;
  })();

  async function persist() {
    if (hasDuplicates) return;
    setSaving(true);
    try {
      const deletes = drafts.filter((d) => d.deleted && !d.isNew);
      await Promise.all(
        deletes.map((d) => deleteDoc(doc(db, Collections.Accounts, account.id, SubCollections.Balances, d.id)))
      );
      const updates = drafts.filter((d) => !d.isNew && !d.deleted);
      await Promise.all(
        updates.map((d) => {
          const amount = Number(d.amount || 0);
          return updateDoc(doc(db, Collections.Accounts, account.id, SubCollections.Balances, d.id), {
            currencyId: d.currencyId,
            amount,
          } as any);
        })
      );
      const creates = drafts.filter((d) => d.isNew && !d.deleted);
      await Promise.all(
        creates.map((d) =>
          addDoc(collection(db, Collections.Accounts, account.id, SubCollections.Balances), {
            currencyId: d.currencyId,
            amount: Number(d.amount || 0),
            createdAt: serverTimestamp(),
          })
        )
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border rounded-md p-3">
      <div className="flex items-center gap-2">
        {editingName !== undefined && editingName !== "" ? (
          <>
            <Input className="max-w-xs" value={editingName} onChange={(e) => setEditingName(e.target.value)} />
            <Button variant="secondary" onClick={onSave}>Сохранить</Button>
            <Button variant="ghost" onClick={() => setEditingName("")}>Отмена</Button>
          </>
        ) : (
          <>
            <div className="text-base font-medium flex-1">{account.name}</div>
            <Button variant="outline" onClick={() => setEditingName(account.name)}>Переименовать</Button>
            <Button variant="destructive" onClick={onAskDelete}>Удалить</Button>
          </>
        )}
      </div>

      <div className="mt-4 grid justify-start gap-2">
        {visibleDrafts.map((b) => (
          <div key={b.id} className="flex items-center gap-2">
            <Select value={b.currencyId} onValueChange={(v) => updateDraft(b.id, { currencyId: v })}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Выберите валюту" />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="w-40"
              type="number"
              value={String(b.amount)}
              onChange={(e) => updateDraft(b.id, { amount: e.target.value })}
            />
            <span className={Number(b.amount) >= 0 ? "text-green-600" : "text-red-600"}>
              {Number(b.amount) >= 0 ? "+" : ""}
              {Number(b.amount)}
            </span>
            <span className="text-muted-foreground">
              {currencyLabel(b.currencyId)}
            </span>
            <ConfirmBalanceDelete
              onDelete={() => {
                if ((b as any).isNew) {
                  setDrafts((ds) => ds.filter((x) => x.id !== b.id));
                } else {
                  markDelete(b.id);
                }
              }}
            />
          </div>
        ))}

        <div className="flex items-center gap-2 pt-2">
          <Select value={adding.currencyId} onValueChange={(v) => setAdding((s) => ({ ...s, currencyId: v }))}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Выберите валюту" />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="w-40"
            type="number"
            value={adding.amount}
            onChange={(e) => setAdding((s) => ({ ...s, amount: e.target.value }))}
          />
          <Button onClick={addBalance} variant="outline">Добавить валюту</Button>
        </div>

        {addError ? (
          <Alert className="mt-2" variant="default">{addError}</Alert>
        ) : null}

        <div className="pt-2 flex gap-2">
          <Button
            onClick={persist}
            loading={saving}
            disabled={!isDirty || hasDuplicates}
            title={hasDuplicates ? "Исправьте дубликаты валют" : undefined}
          >
            Обновить
          </Button>
          {hasDuplicates ? (
            <span className="text-xs text-red-600 self-center">Выбраны повторяющиеся валюты. Сделайте их уникальными.</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ConfirmBalanceDelete({ onDelete }: { onDelete: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" className="ml-auto" onClick={() => setOpen(true)}>Удалить</Button>
      <ConfirmDialog
        open={open}
        title="Удалить валюту счета?"
        description={`Будет удалена валюта и её остаток из этого счета.`}
        onConfirm={onDelete}
        onOpenChange={setOpen}
      />
    </>
  );
}
