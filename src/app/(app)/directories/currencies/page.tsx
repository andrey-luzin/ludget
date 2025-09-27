"use client";

import { useEffect, useMemo, useState } from "react";
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
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import type { Currency } from "@/types/entities";

const MAX_ORDER_VALUE = Number.MAX_SAFE_INTEGER;

function compareCurrencies(a: Currency, b: Currency) {
  const orderA = a.order ?? MAX_ORDER_VALUE;
  const orderB = b.order ?? MAX_ORDER_VALUE;
  if (orderA !== orderB) {
    return orderA - orderB;
  }
  return a.name.localeCompare(b.name, "ru", { sensitivity: "base" });
}

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
      setCurrencies(
        snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name,
            order: typeof data.order === "number" ? data.order : undefined,
          } as Currency;
        })
      );
    });
    return () => unsub();
  }, [ownerUid]);

  const orderedCurrencies = useMemo(() => {
    return [...currencies].sort(compareCurrencies);
  }, [currencies]);

  async function addCurrency() {
    if (!newName.trim()) {
      setAddError("Пожалуйста, введите название валюты.");
      return;
    }
    setPendingAdd(true);
    try {
      const nextOrder = orderedCurrencies.reduce(
        (max, currency) => Math.max(max, currency.order ?? -1),
        -1
      ) + 1;
      await addDoc(collection(db, Collections.Currencies), {
        name: newName.trim(),
        createdAt: serverTimestamp(),
        ownerUid,
        order: nextOrder,
      });
      setNewName("");
      setAddError(null);
    } finally {
      setPendingAdd(false);
    }
  }

  async function saveEdit(id: string) {
    const draft = editing[id]?.trim();
    if (!draft) {
      return;
    }
    await updateDoc(doc(db, Collections.Currencies, id), { name: draft });
    setEditing((state) => ({ ...state, [id]: "" }));
  }

  async function deleteCurrency(id: string) {
    try {
      await deleteDoc(doc(db, Collections.Currencies, id));
      return;
    } catch (e: any) {
      try {
        // On failure (e.g., permission), try to detect usage with non-zero balances
        const q = query(collectionGroup(db, SubCollections.Balances), where("currencyId", "==", id));
        const usedSnap = await getDocs(q);
        const nonZeroCount = usedSnap.docs.filter((d) => {
          const data = d.data() as any;
          return Number(data?.amount || 0) !== 0;
        }).length;
        if (nonZeroCount > 0) {
          const name = currencies.find((c) => c.id === id)?.name || "(неизвестная)";
          setBlocked({ name, count: nonZeroCount });
          return;
        }
      } catch {}
      setBlocked({ name: currencies.find((c) => c.id === id)?.name || "(неизвестная)", count: -1 });
    }
  }

  async function askDeleteCurrency(currency: Currency) {
    // Optimistically show confirmation; validation will run on actual delete
    setConfirm({ id: currency.id, name: currency.name });
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
        {orderedCurrencies.map((currency) => {
          const draftName = editing[currency.id] ?? "";
          const isEditing = Boolean(draftName);
          return (
            <div key={currency.id} className="flex items-center gap-2 border rounded-md p-2 pl-4">
              {isEditing ? (
                <Input
                  value={draftName}
                  onChange={(e) => setEditing((state) => ({ ...state, [currency.id]: e.target.value }))}
                />
              ) : (
                <div className="flex-1">{currency.name}</div>
              )}
              {isEditing ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => saveEdit(currency.id)}
                    disabled={!draftName.trim()}
                  >
                    Сохранить
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing((state) => ({ ...state, [currency.id]: "" }))}>
                    Отмена
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setEditing((state) => ({ ...state, [currency.id]: currency.name }))}
                  >
                    Редактировать
                  </Button>
                  <Button variant="destructive" onClick={() => askDeleteCurrency(currency)}>
                    Удалить
                  </Button>
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
        onConfirm={() => (confirm ? deleteCurrency(confirm.id) : undefined)}
        onOpenChange={(open) => !open && setConfirm(null)}
      />
      <InfoDialog
        open={Boolean(blocked)}
        title="Нельзя удалить валюту"
        description={
          blocked
            ? blocked.count === -1
              ? `Не удалось проверить использование валюты "${blocked.name}".
Возможно, не хватает прав на чтение. Попробуйте позже или обратитесь к администратору.`
              : `Валюта "${blocked.name}" используется в ${blocked.count} счете(ах).
Удалите её из счетов прежде чем удалять валюту.`
            : undefined
        }
        onOpenChange={(open) => !open && setBlocked(null)}
      />
    </div>
  );
}
