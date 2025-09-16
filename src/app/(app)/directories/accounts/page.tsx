"use client";

import { useEffect, useState, useId } from "react";
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
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
  where,
} from "firebase/firestore";
import { Collections, SubCollections } from "@/types/collections";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import type { Account, Balance, Currency } from "@/types/entities";

export default function AccountsPage() {
  const { ownerUid } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [newName, setNewName] = useState("");
  const [addAccountError, setAddAccountError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [confirmAccount, setConfirmAccount] = useState<Account | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [pendingAdd, setPendingAdd] = useState(false);
  const addAccountNameId = useId();

  useEffect(() => {
    if (!ownerUid) return;
    const unsub = onSnapshot(query(collection(db, Collections.Accounts), where("ownerUid", "==", ownerUid), orderBy("name")), (snap) => {
      setAccounts(
        snap.docs.map((d) => {
          const data = d.data() as any;
          return { id: d.id, name: data.name, color: data.color, iconUrl: data.iconUrl } as Account;
        })
      );
    });
    return () => unsub();
  }, [ownerUid]);

  useEffect(() => {
    if (!ownerUid) return;
    const unsub = onSnapshot(query(collection(db, Collections.Currencies), where("ownerUid", "==", ownerUid), orderBy("name")), (snap) => {
      setCurrencies(snap.docs.map((d) => ({ id: d.id, name: (d.data() as any).name })));
    });
    return () => unsub();
  }, [ownerUid]);

  async function addAccount() {
    if (!newName.trim()) {
      setAddAccountError("Пожалуйста, введите название счета.");
      return;
    }
    setPendingAdd(true);
    try {
      await addDoc(collection(db, Collections.Accounts), { name: newName.trim(), createdAt: serverTimestamp(), ownerUid });
      setNewName("");
      setAddAccountError(null);
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

  <div className="mt-6 flex items-end gap-2">
    <div className="grid gap-1 grow-1">
      <Label htmlFor={addAccountNameId}>Добавить счет</Label>
      <Input
        id={addAccountNameId}
        placeholder="Название счета"
        value={newName}
        onChange={(e) => {
          setNewName(e.target.value);
          if (addAccountError) {
            setAddAccountError(null);
          }
        }}
      />
    </div>
    <Button onClick={addAccount} loading={pendingAdd}>Добавить</Button>
  </div>
      {addAccountError ? <Alert className="mt-2">{addAccountError}</Alert> : null}

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
  editingName?: string; // legacy, not used in new flow
  setEditingName: (name: string) => void; // legacy, not used in new flow
  onSave: () => void; // legacy, not used in new flow
  onAskDelete: () => void;
}) {
  const { ownerUid } = useAuth();
  const editNameId = useId();
  const colorId = useId();
  const addCurSelId = useId();
  const addAmtId = useId();
  const [serverBalances, setServerBalances] = useState<Balance[]>([]);
  const [drafts, setDrafts] = useState<{ id: string; currencyId: string; amount: string; isNew?: boolean; deleted?: boolean }[]>([]);
  const [adding, setAdding] = useState<{ currencyId: string; amount: string }>({ currencyId: "", amount: "0" });
  const [addError, setAddError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showBalancesEditor, setShowBalancesEditor] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editName, setEditName] = useState(account.name);
  const [editColor, setEditColor] = useState<string>(account.color || "#000000");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const iconFileId = useId();

  const handleIconFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !ownerUid) return;
    try {
      setUploadingIcon(true);
      const storage = getStorage();
      const ext = (() => {
        const map: Record<string, string> = {
          "image/svg+xml": ".svg",
          "image/png": ".png",
          "image/webp": ".webp",
          "image/jpeg": ".jpg",
        };
        return map[file.type] || "";
      })();
      const path = `icons/${ownerUid}/${account.id}${ext || ''}`;
      const r = ref(storage, path);
      await uploadBytes(r, file, { contentType: file.type, cacheControl: "public,max-age=31536000,immutable" });
      const url = await getDownloadURL(r);
      await updateDoc(doc(db, Collections.Accounts, account.id), { iconUrl: url } as any);
    } finally {
      setUploadingIcon(false);
      // reset input so same file can be re-selected
      e.currentTarget.value = "";
    }
  };

  const handleIconDelete = async () => {
    if (!ownerUid || !account.iconUrl) return;
    try {
      setUploadingIcon(true);
      const storage = getStorage();
      const fileRef = ref(storage, account.iconUrl);
      await deleteObject(fileRef).catch(() => undefined);
    } finally {
      await updateDoc(doc(db, Collections.Accounts, account.id), { iconUrl: null } as any);
      setUploadingIcon(false);
    }
  };

  // When opening editor, sync name and color
  useEffect(() => {
    if (showBalancesEditor) {
      setEditName(account.name);
      setEditColor(account.color || "#000000");
    }
  }, [showBalancesEditor, account.name, account.color]);

  useEffect(() => {
    if (!ownerUid) return;
    const q = query(
      collection(db, Collections.Accounts, account.id, SubCollections.Balances),
      where("ownerUid", "==", ownerUid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() as any;
          return { id: d.id, currencyId: String(data.currencyId), amount: Number(data.amount) } as Balance;
        });
        setServerBalances(list);
        setDrafts(list.map((b) => ({ id: b.id, currencyId: b.currencyId, amount: String(b.amount) })));
      },
      (err) => {
        console.warn("balances listener error", err);
      }
    );
    return () => unsub();
  }, [account.id, ownerUid]);

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

  // Immediate create in Firestore (used by outside add-currency block)
  async function addBalanceImmediate(): Promise<boolean> {
    const currencyId = adding.currencyId;
    const amount = Number(adding.amount || 0);
    if (!currencyId) {
      setAddError("Пожалуйста, выберите валюту перед добавлением.");
      return false;
    }
    // Prevent duplicates
    if (serverBalances.some((b) => b.currencyId === currencyId)) {
      setAddError("Эта валюта уже добавлена в счет.");
      return false;
    }
    try {
      await addDoc(collection(db, Collections.Accounts, account.id, SubCollections.Balances), {
        currencyId,
        amount,
        createdAt: serverTimestamp(),
        ownerUid,
      } as any);
      setAdding({ currencyId: "", amount: "0" });
      setAddError(null);
      return true;
    } catch (e) {
      setAddError("Не удалось добавить валюту. Попробуйте ещё раз.");
      return false;
    }
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
            ownerUid,
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
        <div className="text-base font-medium flex-1 flex items-center gap-2" style={{ color: account.color || undefined }}>
          {account.iconUrl ? (
            <img src={account.iconUrl} alt="" className="h-5 w-5 rounded-sm object-contain" />
          ) : null}
          <span>{account.name}</span>
        </div>
        <Button variant="secondary" onClick={() => setShowBalancesEditor((s) => !s)}>
          {showBalancesEditor ? "Свернуть" : "Править"}
        </Button>
        <Button variant="destructive" onClick={onAskDelete}>Удалить</Button>
      </div>

      {/* Collapsed primitive view */}
      {!showBalancesEditor ? (
        <div className="my-3 text-muted-foreground">
          {serverBalances.length === 0 ? (
            <span>Валюты не добавлены</span>
          ) : (
            <div className="flex flex-col gap-y-3">
              {serverBalances.map((b) => {
                const currency = currencyLabel(b.currencyId);

                return (
                  <div key={b.id} className="flex items-center gap-1">
                    <span
                      className={cn(
                        "rounded font-semibold px-2 py-0.5",
                        Number(b.amount) >= 0
                          ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10"
                          : "text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-400/10"
                      )}
                    >
                      {b.amount}
                    </span>
                    <span className={cn(
                      "font-medium",
                      { 'text-sm':  currency.length > 2}
                    )}>
                      {currency}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* Expanded editor view */}
      {showBalancesEditor ? (
      <div className="mt-4 grid justify-start gap-2">
        <div className="flex items-end gap-2">
          <div className="grid gap-1">
            <Label htmlFor={editNameId}>Название</Label>
            <Input id={editNameId} className="max-w-xs" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor={colorId}>Цвет</Label>
            <input
              id={colorId}
              type="color"
              value={editColor}
              onChange={(e) => setEditColor(e.target.value)}
              className="h-9 w-10 overflow-hidden rounded cursor-pointer border"
              title="Цвет заголовка"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor={iconFileId}>Иконка</Label>
            <div className="flex items-center gap-3">
              {account.iconUrl && (
                <img src={account.iconUrl} alt="" className="h-8 w-8 rounded-sm object-contain border bg-background" />
              )}
              <Input
                id={iconFileId}
                type="file"
                accept="image/svg+xml,image/png,image/webp,image/jpeg"
                disabled={uploadingIcon}
                onChange={handleIconFileChange}
                className="max-w-xs"
              />
              {account.iconUrl ? (
                <Button type="button" variant="ghost" size="sm" onClick={handleIconDelete} disabled={uploadingIcon}>
                  Удалить
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        {visibleDrafts.map((b) => {
          const currency = currencyLabel(b.currencyId);
          const amount = Number(b.amount);

          return (
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
              <div>
                <span
                  className={cn(
                    "ml-2 px-1.5 py-0.5 rounded text-sm font-semibold",
                    amount >= 0
                      ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10"
                      : "text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-400/10"
                  )}
                >
                  {amount}
                </span>
                <span className={cn(
                  "text-muted-foreground ml-1",
                  { 'text-sm':  currency.length > 2}
                )}>
                  {currency}
                </span>
              </div>
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
          )
        })}

        {/* Add currency block removed from editor area */}

        <div className="pt-2 flex gap-2">
          <Button
            onClick={async () => {
              // Save name/color if changed
              const updates: any = {};
              if (editName.trim() && editName.trim() !== account.name) updates.name = editName.trim();
              if ((account.color || "#000000") !== editColor) updates.color = editColor;
              if (Object.keys(updates).length) {
                await updateDoc(doc(db, Collections.Accounts, account.id), updates);
              }
              await persist();
              setShowBalancesEditor(false);
            }}
            loading={saving}
            disabled={!(isDirty || editName.trim() !== account.name || (account.color || "#000000") !== editColor) || hasDuplicates}
            title={hasDuplicates ? "Исправьте дубликаты валют" : undefined}
          >
            Обновить
          </Button>
          {hasDuplicates ? (
            <span className="text-xs text-red-600 self-center">Выбраны повторяющиеся валюты. Сделайте их уникальными.</span>
          ) : null}
        </div>
      </div>
      ) : null}

      {/* Add currency block - outside editor via toggle */}
      <div className="pt-2">
        {!showAddForm ? (
          <Button variant="outline" onClick={() => setShowAddForm(true)}>Добавить валюту</Button>
        ) : (
          <div className="flex items-end gap-2">
            <div className="grid gap-1">
              <Label htmlFor={addCurSelId}>Валюта</Label>
              <Select value={adding.currencyId} onValueChange={(v) => setAdding((s) => ({ ...s, currencyId: v }))}>
                <SelectTrigger id={addCurSelId} className="w-48">
                  <SelectValue placeholder="Выберите валюту" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor={addAmtId}>Остаток</Label>
              <Input
                id={addAmtId}
                className="w-40"
                type="number"
                value={adding.amount}
                onChange={(e) => setAdding((s) => ({ ...s, amount: e.target.value }))}
              />
            </div>
            <Button className="self-end" onClick={async () => { const ok = await addBalanceImmediate(); if (ok) setShowAddForm(false); }}>
              Добавить
            </Button>
            <Button className="self-end" variant="ghost" onClick={() => setShowAddForm(false)}>
              Отмена
            </Button>
          </div>
        )}
        {addError ? (
          <Alert className="mt-2" variant="default">{addError}</Alert>
        ) : null}
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
