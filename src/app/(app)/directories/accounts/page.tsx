"use client";

import { useCallback, useEffect, useState, useId } from "react";
import type { CSSProperties, ReactNode } from "react";
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, PenLine, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { deleteAccountIcon, uploadAccountIcon } from "@/lib/account-icon-storage";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { Collections, SubCollections } from "@/types/collections";
import type { Account, Balance, Currency } from "@/types/entities";

export default function AccountsPage() {
  const { ownerUid, userUid, showOnlyMyAccounts } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [newName, setNewName] = useState("");
  const [addAccountError, setAddAccountError] = useState<string | null>(null);
  const [confirmAccount, setConfirmAccount] = useState<Account | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [pendingAdd, setPendingAdd] = useState(false);
  const addAccountNameId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const persistAccountOrder = useCallback(async (orderedAccounts: Account[]) => {
    const batch = writeBatch(db);
    orderedAccounts.forEach((acc, index) => {
      batch.update(doc(db, Collections.Accounts, acc.id), { order: index } as any);
    });
    try {
      await batch.commit();
    } catch (err) {
      console.error("Failed to persist accounts order", err);
    }
  }, []);

  const handleAccountDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    setAccounts((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === active.id);
      const newIndex = prev.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) {
        return prev;
      }
      const reordered = arrayMove(prev, oldIndex, newIndex).map((item, idx) => ({
        ...item,
        order: idx,
      }));
      void persistAccountOrder(reordered);
      return reordered;
    });
  }, [persistAccountOrder]);

  useEffect(() => {
    if (!ownerUid) return;
    const unsub = onSnapshot(
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
        const filtered = showOnlyMyAccounts && userUid
          ? sorted.filter((acc) => (acc.createdBy ?? ownerUid) === userUid)
          : sorted;
        setAccounts(filtered);
        const missingOrder = mapped.some((acc) => acc.order == null);
        if (missingOrder) {
          void persistAccountOrder(sorted.map((acc, idx) => ({ ...acc, order: idx })));
        }
      }
    );
    return () => unsub();
  }, [ownerUid, persistAccountOrder, showOnlyMyAccounts, userUid]);

  useEffect(() => {
    if (!ownerUid) return;
    const unsub = onSnapshot(
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
      }
    );
    return () => unsub();
  }, [ownerUid]);

  async function addAccount() {
    if (!newName.trim()) {
      setAddAccountError("Пожалуйста, введите название счета.");
      return;
    }
    setPendingAdd(true);
    try {
      const currentMaxOrder = accounts.reduce(
        (max, acc) => Math.max(max, acc.order ?? -1),
        -1
      );
      const nextOrder = currentMaxOrder + 1;
      await addDoc(collection(db, Collections.Accounts), {
        name: newName.trim(),
        createdAt: serverTimestamp(),
        ownerUid,
        createdBy: userUid ?? ownerUid,
        order: nextOrder,
      });
      setNewName("");
      setAddAccountError(null);
    } finally {
      setPendingAdd(false);
    }
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleAccountDragEnd}
      >
        <SortableContext items={accounts.map((acc) => acc.id)} strategy={verticalListSortingStrategy}>
          <div className="mt-6 grid gap-3">
            {accounts.map((acc) => (
              <SortableAccountItem
                key={acc.id}
                account={acc}
                currencies={currencies}
                onAskDelete={() => setConfirmAccount(acc)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

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

type AccountItemProps = {
  account: Account;
  currencies: Currency[];
  onAskDelete: () => void;
  dragHandle?: ReactNode;
  isSorting?: boolean;
};

function SortableAccountItem(props: AccountItemProps) {
  const { account, dragHandle: providedHandle, ...rest } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: account.id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handle = providedHandle ?? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing -ml-1.5"
      aria-label="Изменить порядок счета"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" />
    </Button>
  );

  return (
    <div ref={setNodeRef} style={style} className={cn("relative", isDragging && "z-10")}
    >
      <AccountItem
        {...rest}
        account={account}
        dragHandle={handle}
        isSorting={isDragging}
      />
    </div>
  );
}

function AccountItem({
  account,
  currencies,
  onAskDelete,
  dragHandle,
  isSorting,
}: AccountItemProps) {
  const { ownerUid } = useAuth();
  const editNameId = useId();
  const colorId = useId();
  const [serverBalances, setServerBalances] = useState<Balance[]>([]);
  const [drafts, setDrafts] = useState<{ currencyId: string; amount: string; balanceId?: string; touched?: boolean }[]>([]);
  const [saving, setSaving] = useState(false);
  const [showBalancesEditor, setShowBalancesEditor] = useState(false);
  const [editName, setEditName] = useState(account.name);
  const [editColor, setEditColor] = useState<string>(account.color || "#000000");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const iconFileId = useId();

  const handleIconFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.currentTarget;
    const file = inputEl.files?.[0];
    if (!file || !ownerUid) return;
    
    try {
      setUploadingIcon(true);
      const { url } = await uploadAccountIcon(ownerUid, account.id, file);
      await updateDoc(doc(db, Collections.Accounts, account.id), { iconUrl: url } as any);
    } catch (err) {
      console.error("account icon upload failed", err);
    } finally {
      setUploadingIcon(false);
      // reset input so same file can be re-selected
      if (inputEl) {
        inputEl.value = "";
      }
    }
  };

  const handleIconDelete = async () => {
    if (!ownerUid || !account.iconUrl) return;
    try {
      setUploadingIcon(true);
      await deleteAccountIcon({ url: account.iconUrl });
    } catch (err) {
      console.warn("Не удалось удалить иконку из S3", err);
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
      },
      (err) => {
        console.warn("balances listener error", err);
      }
    );
    return () => unsub();
  }, [account.id, ownerUid]);

  useEffect(() => {
    if (!currencies.length) {
      setDrafts([]);
      return;
    }
    setDrafts((prev) => {
      const prevMap = new Map(prev.map((d) => [d.currencyId, d] as const));
      const serverMap = new Map(serverBalances.map((b) => [b.currencyId, b] as const));
      return currencies.map((currency) => {
        const previous = prevMap.get(currency.id);
        const server = serverMap.get(currency.id);
        // Prefer server amount unless the user has already edited this draft.
        const amount = previous?.touched
          ? previous.amount
          : server
            ? String(server.amount)
            : previous?.amount ?? "0";
        return {
          currencyId: currency.id,
          amount,
          balanceId: server?.id,
          touched: previous?.touched ?? false,
        };
      });
    });
  }, [currencies, serverBalances]);

  function updateDraft(currencyId: string, amount: string) {
    setDrafts((ds) => ds.map((d) => (d.currencyId === currencyId ? { ...d, amount, touched: true } : d)));
  }

  function currencyLabel(id: string) {
    return currencies.find((c) => c.id === id)?.name ?? "—";
  }

  const serverBalanceMap = new Map(serverBalances.map((b) => [b.currencyId, b] as const));
  const mergedBalances = currencies.map((currency) => {
    const fromServer = serverBalanceMap.get(currency.id);
    return {
      currencyId: currency.id,
      amount: fromServer ? Number(fromServer.amount) : 0,
      id: fromServer?.id ?? currency.id,
    };
  });
  const nonZeroBalances = mergedBalances.filter((b) => Number(b.amount) !== 0);

  const balancesDirty = drafts.some((draft) => {
    const server = serverBalanceMap.get(draft.currencyId);
    const draftAmount = Number(draft.amount || 0);
    if (!server) {
      return draftAmount !== 0;
    }
    return Number(server.amount) !== draftAmount;
  });
  const nameDirty = editName.trim() !== account.name;
  const colorDirty = (account.color || "#000000") !== editColor;
  const canSave = balancesDirty || nameDirty || colorDirty;

  async function persist() {
    setSaving(true);
    try {
      const updates = drafts.filter((draft) => {
        if (!draft.balanceId) {
          return false;
        }
        const server = serverBalanceMap.get(draft.currencyId);
        if (!server) {
          return true;
        }
        return Number(server.amount) !== Number(draft.amount || 0);
      });

      await Promise.all(
        updates.map((draft) =>
          updateDoc(doc(db, Collections.Accounts, account.id, SubCollections.Balances, draft.balanceId as string), {
            amount: Number(draft.amount || 0),
          } as any)
        )
      );

      const creates = drafts.filter((draft) => !draft.balanceId && Number(draft.amount || 0) !== 0);
      await Promise.all(
        creates.map((draft) =>
          addDoc(collection(db, Collections.Accounts, account.id, SubCollections.Balances), {
            currencyId: draft.currencyId,
            amount: Number(draft.amount || 0),
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
    <div
      className={cn(
        "border rounded-md p-3 bg-background",
        isSorting && "shadow-lg ring-1 ring-primary/30"
      )}
    >
      <div className="flex items-center gap-2">
        {!showBalancesEditor ? dragHandle : null}
        <div className="text-base font-medium flex-1 flex items-center gap-2" style={{ color: account.color || undefined }}>
          {account.iconUrl ? (
            <img src={account.iconUrl} alt="" className="h-6 w-6 rounded-sm object-contain" />
          ) : null}
          <span>{account.name}</span>
        </div>
        <Button
          variant="secondary"
          onClick={() => setShowBalancesEditor((s) => !s)}
          title={showBalancesEditor ? "Свернуть" : "Править"}
        >
          <PenLine className="h-4 w-4" />
          <span className={cn({ "max-lg:hidden": !showBalancesEditor })}>
            {showBalancesEditor ? "Свернуть" : "Править"}
          </span>
        </Button>
        <Button variant="destructive" onClick={onAskDelete} title="Удалить">
          <Trash2 className="h-4 w-4" />
          <span className="max-lg:hidden">Удалить</span>
        </Button>
      </div>

      {/* Collapsed primitive view */}
      {!showBalancesEditor ? (
        <div className="my-3 text-muted-foreground">
          {nonZeroBalances.length === 0 ? (
            <span>Нет валют с ненулевым остатком</span>
          ) : (
            <div className="flex flex-col gap-y-3">
              {nonZeroBalances.map((b) => {
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
                    <span
                      className={cn("font-medium", {
                        "text-sm": currency.length > 2,
                      })}
                    >
                      {currency}
                    </span>
                  </div>
                );
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleIconDelete}
                  disabled={uploadingIcon}
                  title="Удалить иконку"
                >
                  <Trash2 className="h-4 w-4 mr-1 text-destructive" />
                  <span className="lg:hidden">Удалить</span>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        {drafts.map((draft) => {
          const currency = currencyLabel(draft.currencyId);
          const amount = Number(draft.amount || 0);

          return (
            <div key={draft.currencyId} className="flex items-center gap-3">
              <div className="w-48 text-sm font-medium text-muted-foreground">{currency}</div>
              <Input
                className="w-40"
                type="number"
                value={draft.amount}
                onChange={(e) => updateDraft(draft.currencyId, e.target.value)}
              />
            </div>
          );
        })}

        <div className="pt-2 flex gap-2">
          <Button
            onClick={async () => {
              // Save name/color if changed
              const updates: any = {};
              if (editName.trim() && editName.trim() !== account.name) {
                updates.name = editName.trim();
              }
              if ((account.color || "#000000") !== editColor) {
                updates.color = editColor;
              }
              if (Object.keys(updates).length) {
                await updateDoc(doc(db, Collections.Accounts, account.id), updates);
              }
              await persist();
              setShowBalancesEditor(false);
            }}
            loading={saving}
            disabled={!canSave}
          >
            Обновить
          </Button>
        </div>
      </div>
      ) : null}

    </div>
  );
}
