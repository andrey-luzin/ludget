"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Collections } from "@/types/collections";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, where } from "firebase/firestore";
import { ConfirmDialog, InfoDialog } from "@/components/ui/confirm-dialog";

type Source = { id: string; name: string; parentId?: string | null };

export default function IncomeSourcesPage() {
  const ROOT = "__root__";
  const { ownerUid } = useAuth();
  const [items, setItems] = useState<Source[]>([]);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>(ROOT);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Source | null>(null);
  const [blocked, setBlocked] = useState<{ name: string; count: number } | null>(null);

  useEffect(() => {
    if (!ownerUid) {
      return;
    }
    const q = query(collection(db, Collections.IncomeSources), where("ownerUid", "==", ownerUid), orderBy("name"));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Source[]);
    });
    return () => unsub();
  }, [ownerUid]);

  async function addItem() {
    if (!name.trim()) {
      setError("Введите название источника дохода.");
      return;
    }
    setPending(true);
    try {
      await addDoc(collection(db, Collections.IncomeSources), {
        name: name.trim(),
        parentId: parentId === ROOT ? null : parentId,
        ownerUid,
        createdAt: serverTimestamp(),
      });
      setName("");
      setParentId(ROOT);
      setError(null);
    } finally {
      setPending(false);
    }
  }

  const roots = useMemo(() => items.filter((c) => !c.parentId), [items]);

  function hasChildren(id: string) {
    return items.some((c) => c.parentId === id);
  }

  function askDelete(s: Source) {
    if (hasChildren(s.id)) {
      const count = items.filter((x) => x.parentId === s.id).length;
      setBlocked({ name: s.name, count });
      return;
    }
    setConfirmDel(s);
  }

  const handleNameChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    setName(e.target.value);
    if (error) {
      setError(null);
    }
  };
  const handleParentChange = (v: string) => {
    setParentId(v);
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Источники доходов</h1>
      <p className="text-muted-foreground mt-1">Добавьте источники и подкатегории.</p>

      <div className="mt-6 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end sm:gap-3">
        <div className="grid gap-1">
          <label className="text-sm font-medium">Название</label>
          <Input placeholder="Название источника" value={name} onChange={handleNameChange} />
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium">Вложенность</label>
          <Select value={parentId} onValueChange={handleParentChange}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ROOT}>Без родителя</SelectItem>
              {roots.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Button onClick={addItem} loading={pending}>Добавить</Button>
        </div>
      </div>
      {error ? <Alert className="mt-2">{error}</Alert> : null}

      <div className="mt-6 grid gap-2">
        {roots.map((r) => {
          const currentItems = items.filter((c) => c.parentId === r.id);

          return (
            <div key={r.id} className="border rounded-md p-3">
              <div className="font-medium flex items-center gap-2">
                <span className="flex-1">{r.name}</span>
                <Button variant="destructive" onClick={() => askDelete(r)}>Удалить</Button>
              </div>
              {currentItems?.length ? (
                <div className="mt-2 pl-4 grid gap-1">
                  {currentItems.map((sc) => (
                    <div key={sc.id} className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="flex-1">— {sc.name}</span>
                      <Button variant="ghost" onClick={() => askDelete(sc)}>Удалить</Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={Boolean(confirmDel)}
        title="Удалить источник?"
        description={confirmDel ? `Источник "${confirmDel.name}" будет удален.` : undefined}
        onConfirm={() => confirmDel ? deleteDoc(doc(db, Collections.IncomeSources, confirmDel.id)) : undefined}
        onOpenChange={(o) => !o && setConfirmDel(null)}
      />
      <InfoDialog
        open={Boolean(blocked)}
        title="Нельзя удалить источник"
        description={blocked ? `Источник "${blocked.name}" имеет ${blocked.count} подкатегори(ю/и).
Сначала удалите подкатегории.` : undefined}
        onOpenChange={(o) => !o && setBlocked(null)}
      />
    </div>
  );
}
