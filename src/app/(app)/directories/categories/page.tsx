"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Collections } from "@/types/collections";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { ConfirmDialog, InfoDialog } from "@/components/ui/confirm-dialog";
import type { Category } from "@/types/entities";

export default function CategoriesPage() {
  const ROOT = "__root__";
  const { ownerUid } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>(ROOT);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Category | null>(null);
  const [blocked, setBlocked] = useState<{ name: string; count: number } | null>(null);

  useEffect(() => {
    if (!ownerUid) {
      return;
    }
    const q = query(collection(db, Collections.Categories), where("ownerUid", "==", ownerUid), orderBy("name"));
    const unsub = onSnapshot(q, (snap) => {
      setCategories(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Category[]);
    });
    return () => unsub();
  }, [ownerUid]);

  async function addCategory() {
    if (!name.trim()) {
      setError("Введите название категории.");
      return;
    }
    setPending(true);
    try {
      await addDoc(collection(db, Collections.Categories), {
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

  const roots = useMemo(() => categories.filter((c) => !c.parentId), [categories]);

  function hasChildren(id: string) {
    return categories.some((c) => c.parentId === id);
  }

  function askDelete(c: Category) {
    if (hasChildren(c.id)) {
      const count = categories.filter((x) => x.parentId === c.id).length;
      setBlocked({ name: c.name, count });
      return;
    }
    setConfirmDel(c);
  }

  async function doDelete(id: string) {
    await deleteDoc(doc(db, Collections.Categories, id));
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
      <h1 className="text-2xl font-semibold tracking-tight">Категории</h1>
      <p className="text-muted-foreground mt-1">Добавьте категории и подкатегории.</p>

      <div className="mt-6 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end sm:gap-3">
        <div className="grid gap-1">
          <label className="text-sm font-medium">Название</label>
          <Input placeholder="Название категории" value={name} onChange={handleNameChange} />
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
          <Button onClick={addCategory} loading={pending}>Добавить</Button>
        </div>
      </div>
      {error ? <Alert className="mt-2">{error}</Alert> : null}

      <div className="mt-6 grid gap-2">
        {roots.map((r) => {
          const currentCategories = categories.filter((c) => c.parentId === r.id);

          return (
            <div key={r.id} className="border rounded-md p-3">
              <div className="font-medium flex items-center gap-2">
                <span className="flex-1">{r.name}</span>
                <Button variant="destructive" onClick={() => askDelete(r)}>Удалить</Button>
              </div>
              {
                currentCategories?.length ?
                <div className="mt-2 pl-4 grid gap-1">
                  {currentCategories.map((sc) => (
                    <div key={sc.id} className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="flex-1">— {sc.name}</span>
                      <Button variant="ghost" onClick={() => askDelete(sc)}>Удалить</Button>
                    </div>
                  ))}
                </div>
                : null
              }
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={Boolean(confirmDel)}
        title="Удалить категорию?"
        description={confirmDel ? `Категория "${confirmDel.name}" будет удалена.` : undefined}
        onConfirm={() => confirmDel ? doDelete(confirmDel.id) : undefined}
        onOpenChange={(o) => !o && setConfirmDel(null)}
      />
      <InfoDialog
        open={Boolean(blocked)}
        title="Нельзя удалить категорию"
        description={blocked ? `Категория "${blocked.name}" имеет ${blocked.count} подкатегори(ю/и).
Сначала удалите подкатегории.` : undefined}
        onOpenChange={(o) => !o && setBlocked(null)}
      />
    </div>
  );
}
