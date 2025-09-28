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
import { ISO_CURRENCIES } from "@/data/iso-currencies";

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
  const [editing, setEditing] = useState<Record<string, { name: string; code: string } | undefined>>({});
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
            code: data.code || undefined,
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
    const draft = editing[id];
    const draftName = draft?.name?.trim();
    if (!draftName) {
      return;
    }
    await updateDoc(doc(db, Collections.Currencies, id), { name: draftName, code: draft?.code || null } as any);
    setEditing((state) => ({ ...state, [id]: undefined }));
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
          const draft = editing[currency.id];
          const isEditing = Boolean(draft);
          const draftName = draft?.name ?? "";
          const draftCode = draft?.code ?? "";
          return (
            <div key={currency.id} className="flex items-center gap-2 border rounded-md p-2 pl-4">
              {isEditing ? (
                <Input
                  value={draftName}
                  onChange={(e) => setEditing((state) => ({ ...state, [currency.id]: { name: e.target.value, code: draftCode } }))}
                />
              ) : (
                <div className="flex-1">
                  <div className="font-medium">{currency.name}</div>
                </div>
              )}
              <CurrencyCodeSelect
                value={isEditing ? draftCode : (currency.code || "")}
                onChange={(code) => setEditing((state) => ({ ...state, [currency.id]: { name: draftName || currency.name, code } }))}
                disabled={!isEditing}
              />
              {isEditing ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => saveEdit(currency.id)}
                    disabled={!draftName.trim()}
                  >
                    Сохранить
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing((state) => ({ ...state, [currency.id]: undefined }))}>
                    Отмена
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setEditing((state) => ({ ...state, [currency.id]: { name: currency.name, code: currency.code || "" } }))}
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

function CurrencyCodeSelect({ value, onChange, disabled }: { value: string; onChange: (code: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ISO_CURRENCIES;
    return ISO_CURRENCIES.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [query]);

  const label = value ? `${value} — ${ISO_CURRENCIES.find((c) => c.code === value)?.name ?? ""}` : "Выбрать код";

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="text-xs text-muted-foreground">Код</div>
      <div className="relative">
        <div>
          <button type="button" className="border rounded-md px-2 h-8 text-sm disabled:opacity-50" onClick={() => !disabled && setOpen((v) => !v)} disabled={disabled}>
            {label}
          </button>
        </div>
        {open ? (
          <div className="absolute z-10 mt-1 w-64 rounded-md border bg-popover p-2 shadow-md">
            <input
              className="w-full h-8 border rounded px-2 text-sm mb-2"
              placeholder="Поиск..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="max-h-64 overflow-auto">
              {options.map((opt) => (
                <button
                  key={opt.code}
                  type="button"
                  className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted"
                  onClick={() => {
                    onChange(opt.code);
                    setOpen(false);
                  }}
                >
                  <span className="font-mono mr-2">{opt.code}</span>
                  <span className="text-muted-foreground">{opt.name}</span>
                </button>
              ))}
              {options.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">Ничего не найдено</div>
              ) : null}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button type="button" className="text-sm text-muted-foreground" onClick={() => onChange("")}>Очистить</button>
              <button type="button" className="text-sm" onClick={() => setOpen(false)}>Закрыть</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
