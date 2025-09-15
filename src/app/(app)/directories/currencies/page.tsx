"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, InfoDialog } from "@/components/ui/confirm-dialog";
import { Alert } from "@/components/ui/alert";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Collections, SubCollections } from "@/types/collections";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  collectionGroup,
  getDocs,
  where,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

type Currency = { id: string; name: string };

export default function CurrenciesPage() {
  const { ownerUid } = useAuth();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null);
  const [pendingAdd, setPendingAdd] = useState(false);
  const [blocked, setBlocked] = useState<{ name: string; count: number } | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerUid) return;
    const q = query(
      collection(db, Collections.Currencies),
      where("ownerUid", "==", ownerUid),
      orderBy("name")
    );
    const unsub = onSnapshot(q, (snap) => {
      setCurrencies(snap.docs.map((d) => ({ id: d.id, name: (d.data() as any).name })));
    });
    return () => unsub();
  }, [ownerUid]);

  async function addCurrency() {
    if (!newName.trim()) {
      setAddError("Пожалуйста, введите название валюты.");
      return;
    }
    setPendingAdd(true);
    try {
      await addDoc(collection(db, Collections.Currencies), {
        name: newName.trim(),
        createdAt: serverTimestamp(),
        ownerUid,
      });
      setNewName("");
      setAddError(null);
    } finally {
      setPendingAdd(false);
    }
  }

  async function saveEdit(id: string) {
    const name = editing[id]?.trim();
    if (!name) return;
    await updateDoc(doc(db, Collections.Currencies, id), { name });
    setEditing((s) => ({ ...s, [id]: "" }));
  }

  async function deleteCurrency(id: string) {
    try {
      const q = query(
        collectionGroup(db, SubCollections.Balances),
        where("ownerUid", "==", ownerUid ?? "__none__"),
        where("currencyId", "==", id)
      );
      const usedSnap = await getDocs(q);
      const count = usedSnap.size;
      if (count > 0) {
        const name = currencies.find((c) => c.id === id)?.name || "(неизвестная)";
        setBlocked({ name, count });
        return;
      }
      await deleteDoc(doc(db, Collections.Currencies, id));
    } catch (e) {
      setBlocked({ name: currencies.find((c) => c.id === id)?.name || "(неизвестная)", count: -1 });
    }
  }

  async function askDeleteCurrency(c: Currency) {
    try {
      // Check if this currency is used in any account balances of current user
      const q = query(
        collectionGroup(db, SubCollections.Balances),
        where("ownerUid", "==", ownerUid ?? "__none__"),
        where("currencyId", "==", c.id)
      );
      const usedSnap = await getDocs(q);
      
      if (usedSnap.size > 0) {
        setBlocked({ name: c.name, count: usedSnap.size });
        return;
      }
      setConfirm({ id: c.id, name: c.name });
    } catch (e) {
      // If check fails (rules/network), allow user to continue to confirmation
      setConfirm({ id: c.id, name: c.name });
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Валюты</h1>
      <p className="text-muted-foreground mt-1">Добавляйте, редактируйте и удаляйте валюты.</p>

      <div className="mt-6 flex gap-2">
        <Input
          placeholder="Название валюты"
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value);
            if (addError) setAddError(null);
          }}
        />
        <Button onClick={addCurrency} loading={pendingAdd}>Добавить</Button>
      </div>
      {addError ? <Alert className="mt-2">{addError}</Alert> : null}

      <div className="mt-6 grid gap-2">
        {currencies.map((c) => {
          const isEditing = Boolean(editing[c.id]);
          return (
            <div key={c.id} className="flex items-center gap-2 border rounded-md p-2 pl-4">
              {isEditing ? (
                <Input
                  value={editing[c.id]}
                  onChange={(e) => setEditing((s) => ({ ...s, [c.id]: e.target.value }))}
                />
              ) : (
                <div className="flex-1">{c.name}</div>
              )}
              {isEditing ? (
                <>
                  <Button variant="secondary" onClick={() => saveEdit(c.id)}>Сохранить</Button>
                  <Button variant="ghost" onClick={() => setEditing((s) => ({ ...s, [c.id]: "" }))}>Отмена</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setEditing((s) => ({ ...s, [c.id]: c.name }))}>Редактировать</Button>
                  <Button variant="destructive" onClick={() => askDeleteCurrency(c)}>Удалить</Button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        title="Удалить валюту?"
        description={confirm ? `Валюта "${confirm.name}" будет удалена безвозвратно.` : undefined}
        onConfirm={() => confirm ? deleteCurrency(confirm.id) : undefined}
        onOpenChange={(o) => !o && setConfirm(null)}
      />
      <InfoDialog
        open={Boolean(blocked)}
        title="Нельзя удалить валюту"
        description={
          blocked
            ? (blocked.count === -1
              ? `Не удалось проверить использование валюты "${blocked.name}".
Возможно, не хватает прав на чтение. Попробуйте позже или обратитесь к администратору.`
              : `Валюта "${blocked.name}" используется в ${blocked.count} счете(ах).
Удалите её из счетов прежде чем удалять валюту.`)
            : undefined
        }
        onOpenChange={(o) => !o && setBlocked(null)}
      />
    </div>
  );
}
