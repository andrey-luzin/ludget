"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ChangeEventHandler, FormEventHandler } from "react";
import { PenLine, Trash2, GripVertical } from "lucide-react";
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/contexts/i18n-context";
import { Collections } from "@/types/collections";
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
  where,
  writeBatch,
} from "firebase/firestore";
import { ConfirmDialog, InfoDialog } from "@/components/ui/confirm-dialog";
import type { Category } from "@/types/entities";

const MAX_ORDER_VALUE = Number.MAX_SAFE_INTEGER;

function compareCategories(a: Category, b: Category) {
  const orderA = a.order ?? MAX_ORDER_VALUE;
  const orderB = b.order ?? MAX_ORDER_VALUE;
  if (orderA !== orderB) {
    return orderA - orderB;
  }
  return a.name.localeCompare(b.name, "ru", { sensitivity: "base" });
}

export default function CategoriesPage() {
  const { t } = useI18n();
  const ROOT = "__root__";
  const { ownerUid } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>(ROOT);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Category | null>(null);
  const [blocked, setBlocked] = useState<{ name: string; count: number } | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [editPending, setEditPending] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const persistRootOrder = useCallback(async (orderedRoots: Category[]) => {
    if (!orderedRoots.length) {
      return;
    }
    const batch = writeBatch(db);
    orderedRoots.forEach((category, index) => {
      batch.update(doc(db, Collections.Categories, category.id), { order: index } as any);
    });
    try {
      await batch.commit();
    } catch (err) {
      console.error("Failed to persist categories order", err);
    }
  }, []);

  useEffect(() => {
    if (!ownerUid) {
      return;
    }
    const q = query(collection(db, Collections.Categories), where("ownerUid", "==", ownerUid), orderBy("name"));
    const unsub = onSnapshot(q, (snap) => {
      const mapped = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name,
          parentId: data.parentId ?? null,
          order: typeof data.order === "number" ? data.order : undefined,
        } as Category;
      });
      setCategories(mapped);
      const rootCategories = mapped.filter((category) => !category.parentId);
      const missingRootOrder = rootCategories.some((category) => category.order == null);
      if (missingRootOrder) {
        const normalized = [...rootCategories]
          .sort(compareCategories)
          .map((category, index) => ({ ...category, order: index }));
        void persistRootOrder(normalized);
      }
    });
    return () => unsub();
  }, [ownerUid, persistRootOrder]);

  async function addCategory() {
    if (!name.trim()) {
      setError(t("categories.errors.name_required"));
      return;
    }
    setPending(true);
    try {
      const isRoot = parentId === ROOT;
      const payload: Record<string, unknown> = {
        name: name.trim(),
        parentId: isRoot ? null : parentId,
        ownerUid,
        createdAt: serverTimestamp(),
      };
      if (isRoot) {
        const nextOrder = orderedRoots.reduce(
          (max, category) => Math.max(max, category.order ?? -1),
          -1
        ) + 1;
        payload.order = nextOrder;
      }
      await addDoc(collection(db, Collections.Categories), payload);
      setName("");
      setParentId(ROOT);
      setError(null);
    } finally {
      setPending(false);
    }
  }

  const orderedRoots = useMemo(() => {
    return categories.filter((c) => !c.parentId).sort(compareCategories);
  }, [categories]);

  const handleRootDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }
      const oldIndex = orderedRoots.findIndex((item) => item.id === active.id);
      const newIndex = orderedRoots.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) {
        return;
      }
      const reorderedRoots = arrayMove(orderedRoots, oldIndex, newIndex).map((root, index) => ({
        ...root,
        order: index,
      }));
      const orderMap = new Map(reorderedRoots.map((root) => [root.id, root.order] as const));
      setCategories((prev) =>
        prev.map((category) => {
          if (category.parentId) {
            return category;
          }
          const nextOrder = orderMap.get(category.id);
          return nextOrder != null ? { ...category, order: nextOrder } : category;
        })
      );
      void persistRootOrder(reorderedRoots);
    },
    [orderedRoots, persistRootOrder]
  );

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

  function startEdit(category: Category) {
    setEditing({ id: category.id, name: category.name });
  }

  function cancelEdit() {
    setEditing(null);
  }

  const handleEditNameChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    setEditing((prev) => (prev ? { ...prev, name: e.target.value } : prev));
  };

  async function saveEdit() {
    if (!editing) {
      return;
    }
    const trimmed = editing.name.trim();
    if (!trimmed) {
      return;
    }
    setEditPending(true);
    try {
      await updateDoc(doc(db, Collections.Categories, editing.id), {
        name: trimmed,
      });
      setEditing(null);
    } finally {
      setEditPending(false);
    }
  }

  const handleEditSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    void saveEdit();
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav.categories")}</h1>
      <p className="text-muted-foreground mt-1">{t("categories.subtitle")}</p>

      <div className="mt-6 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end sm:gap-3">
        <div className="grid gap-1">
          <label className="text-sm font-medium">{t("common.name")}</label>
          <Input placeholder={t("categories.name_placeholder")} value={name} onChange={handleNameChange} />
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium">{t("common.parent")}</label>
          <Select value={parentId} onValueChange={handleParentChange}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ROOT}>{t("common.without_parent")}</SelectItem>
              {orderedRoots.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Button onClick={addCategory} loading={pending}>{t("common.add")}</Button>
        </div>
      </div>
      {error ? <Alert className="mt-2">{error}</Alert> : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRootDragEnd}>
        <SortableContext items={orderedRoots.map((root) => root.id)} strategy={verticalListSortingStrategy}>
          <div className="mt-6 grid gap-2">
            {orderedRoots.map((root) => (
              <SortableRootCategory
                key={root.id}
                category={root}
                categories={categories}
                editing={editing}
                editPending={editPending}
                onStartEdit={startEdit}
                onAskDelete={askDelete}
                onEditSubmit={handleEditSubmit}
                onEditNameChange={handleEditNameChange}
                onCancelEdit={cancelEdit}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <ConfirmDialog
        open={Boolean(confirmDel)}
        title={t("categories.confirm.delete_title")}
        description={confirmDel ? t("categories.confirm.delete_desc").replace("{{name}}", confirmDel.name) : undefined}
        onConfirm={() => confirmDel ? doDelete(confirmDel.id) : undefined}
        onOpenChange={(o) => !o && setConfirmDel(null)}
      />
      <InfoDialog
        open={Boolean(blocked)}
        title={t("categories.blocked.title")}
        description={blocked ? t("categories.blocked.desc").replace("{{name}}", blocked.name).replace("{{count}}", String(blocked.count)) : undefined}
        onOpenChange={(o) => !o && setBlocked(null)}
      />
    </div>
  );
}

type SortableRootCategoryProps = {
  category: Category;
  categories: Category[];
  editing: { id: string; name: string } | null;
  editPending: boolean;
  onStartEdit: (category: Category) => void;
  onAskDelete: (category: Category) => void;
  onEditSubmit: FormEventHandler<HTMLFormElement>;
  onEditNameChange: ChangeEventHandler<HTMLInputElement>;
  onCancelEdit: () => void;
};

function SortableRootCategory({
  category,
  categories,
  editing,
  editPending,
  onStartEdit,
  onAskDelete,
  onEditSubmit,
  onEditNameChange,
  onCancelEdit,
}: SortableRootCategoryProps) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const childCategories = categories
    .filter((item) => item.parentId === category.id)
    .sort(compareCategories);
  const isRootEditing = editing?.id === category.id;
  const editingName = isRootEditing ? editing!.name : "";
  const dragHandle = !isRootEditing ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing -ml-1.5"
      aria-label={t("categories.aria.reorder")}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" />
    </Button>
  ) : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-md border p-3",
        isDragging && "shadow-lg ring-1 ring-primary/30"
      )}
    >
      <div className="flex items-start gap-2">
        {dragHandle && dragHandle}
        {isRootEditing ? (
          <form onSubmit={onEditSubmit} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <Input value={editingName} onChange={onEditNameChange} autoFocus placeholder={t("categories.name_placeholder")} />
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={editPending} disabled={!editingName.trim()}>
                {t("common.save")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={onCancelEdit} disabled={editPending}>
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-1 items-center gap-2">
            <span className="flex-1 font-medium">{category.name}</span>
            <div className="flex items-center gap-1 opacity-50 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t("common.edit")}
                onClick={() => onStartEdit(category)}
              >
                <PenLine className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t("common.delete")}
                onClick={() => onAskDelete(category)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        )}
      </div>
      {childCategories.length ? (
        <div className="mt-2 pl-4 grid gap-1">
          {childCategories.map((child) => {
            const isChildEditing = editing?.id === child.id;
            const childEditingName = isChildEditing ? editing!.name : "";
            return (
              <div
                key={child.id}
                className="flex items-center gap-2 rounded-md pl-1 py-0.5 text-sm text-muted-foreground"
              >
                {isChildEditing ? (
                  <form onSubmit={onEditSubmit} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                    <Input
                      value={childEditingName}
                      onChange={onEditNameChange}
                      autoFocus
                      placeholder={t("categories.name_placeholder")}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" loading={editPending} disabled={!childEditingName.trim()}>
                        {t("common.save")}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={onCancelEdit} disabled={editPending}>
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <span className="flex-1">— {child.name}</span>
                    <div className="flex items-center gap-1 opacity-50 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={t("common.edit")}
                        onClick={() => onStartEdit(child)}
                      >
                        <PenLine className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={t("common.delete")}
                        onClick={() => onAskDelete(child)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
