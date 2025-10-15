"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ChangeEventHandler, FormEventHandler } from "react";
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, PenLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import type { Source } from "@/types/entities";

const MAX_ORDER_VALUE = Number.MAX_SAFE_INTEGER;

function compareSources(a: Source, b: Source) {
  const orderA = a.order ?? MAX_ORDER_VALUE;
  const orderB = b.order ?? MAX_ORDER_VALUE;
  if (orderA !== orderB) {
    return orderA - orderB;
  }
  return a.name.localeCompare(b.name, "ru", { sensitivity: "base" });
}

export default function IncomeSourcesPage() {
  const { t } = useI18n();
  const ROOT = "__root__";
  const { ownerUid } = useAuth();
  const [items, setItems] = useState<Source[]>([]);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>(ROOT);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Source | null>(null);
  const [blocked, setBlocked] = useState<{ name: string; count: number } | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [editPending, setEditPending] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const persistRootOrder = useCallback(async (orderedRoots: Source[]) => {
    if (!orderedRoots.length) {
      return;
    }
    const batch = writeBatch(db);
    orderedRoots.forEach((source, index) => {
      batch.update(doc(db, Collections.IncomeSources, source.id), { order: index } as any);
    });
    try {
      await batch.commit();
    } catch (err) {
      console.error("Failed to persist income sources order", err);
    }
  }, []);

  useEffect(() => {
    if (!ownerUid) {
      return;
    }
    const q = query(
      collection(db, Collections.IncomeSources),
      where("ownerUid", "==", ownerUid),
      orderBy("name")
    );
    const unsub = onSnapshot(q, (snap) => {
      const mapped = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name,
          parentId: data.parentId ?? null,
          order: typeof data.order === "number" ? data.order : undefined,
        } as Source;
      });
      setItems(mapped);
      const rootSources = mapped.filter((source) => !source.parentId);
      const missingRootOrder = rootSources.some((source) => source.order == null);
      if (missingRootOrder) {
        const normalized = [...rootSources]
          .sort(compareSources)
          .map((source, index) => ({ ...source, order: index }));
        void persistRootOrder(normalized);
      }
    });
    return () => unsub();
  }, [ownerUid, persistRootOrder]);

  async function addItem() {
    if (!name.trim()) {
      setError(t("income_sources.errors.name_required"));
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
          (max, source) => Math.max(max, source.order ?? -1),
          -1
        ) + 1;
        payload.order = nextOrder;
      }
      await addDoc(collection(db, Collections.IncomeSources), payload);
      setName("");
      setParentId(ROOT);
      setError(null);
    } finally {
      setPending(false);
    }
  }

  const orderedRoots = useMemo(() => {
    return items.filter((source) => !source.parentId).sort(compareSources);
  }, [items]);

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
      setItems((prev) =>
        prev.map((source) => {
          if (source.parentId) {
            return source;
          }
          const nextOrder = orderMap.get(source.id);
          return nextOrder != null ? { ...source, order: nextOrder } : source;
        })
      );
      void persistRootOrder(reorderedRoots);
    },
    [orderedRoots, persistRootOrder]
  );

  function startEdit(source: Source) {
    setEditing({ id: source.id, name: source.name });
  }

  function cancelEdit() {
    setEditing(null);
  }

  const handleEditNameChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    setEditing((prev) => (prev ? { ...prev, name: event.target.value } : prev));
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
      await updateDoc(doc(db, Collections.IncomeSources, editing.id), {
        name: trimmed,
      });
      setEditing(null);
    } finally {
      setEditPending(false);
    }
  }

  const handleEditSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    void saveEdit();
  };

  function hasChildren(id: string) {
    return items.some((source) => source.parentId === id);
  }

  function askDelete(source: Source) {
    if (hasChildren(source.id)) {
      const count = items.filter((child) => child.parentId === source.id).length;
      setBlocked({ name: source.name, count });
      return;
    }
    setConfirmDel(source);
  }

  async function doDelete(id: string) {
    await deleteDoc(doc(db, Collections.IncomeSources, id));
  }

  const handleNameChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    setName(event.target.value);
    if (error) {
      setError(null);
    }
  };
  const handleParentChange = (v: string) => {
    setParentId(v);
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">{t("income_sources.title")}</h1>
      <p className="text-muted-foreground mt-1">{t("income_sources.subtitle")}</p>

      <div className="mt-6 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end sm:gap-3">
        <div className="grid gap-1">
          <label className="text-sm font-medium">{t("common.name")}</label>
          <Input placeholder={t("income_sources.placeholder")} value={name} onChange={handleNameChange} />
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
          <Button onClick={addItem} loading={pending}>{t("common.add")}</Button>
        </div>
      </div>
      {error ? <Alert className="mt-2">{error}</Alert> : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRootDragEnd}>
        <SortableContext items={orderedRoots.map((root) => root.id)} strategy={verticalListSortingStrategy}>
          <div className="mt-6 grid gap-2">
            {orderedRoots.map((root) => (
              <SortableRootSource
                key={root.id}
                source={root}
                sources={items}
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
        title={t("income_sources.confirm.delete_title")}
        description={confirmDel ? t("income_sources.confirm.delete_desc").replace("{{name}}", confirmDel.name) : undefined}
        onConfirm={() => (confirmDel ? doDelete(confirmDel.id) : undefined)}
        onOpenChange={(open) => !open && setConfirmDel(null)}
      />
      <InfoDialog
        open={Boolean(blocked)}
        title={t("income_sources.blocked.title")}
        description={blocked ? t("income_sources.blocked.desc").replace("{{name}}", blocked.name).replace("{{count}}", String(blocked.count)) : undefined}
        onOpenChange={(o) => !o && setBlocked(null)}
      />
    </div>
  );
}

type SortableRootSourceProps = {
  source: Source;
  sources: Source[];
  editing: { id: string; name: string } | null;
  editPending: boolean;
  onStartEdit: (source: Source) => void;
  onAskDelete: (source: Source) => void;
  onEditSubmit: FormEventHandler<HTMLFormElement>;
  onEditNameChange: ChangeEventHandler<HTMLInputElement>;
  onCancelEdit: () => void;
};

function SortableRootSource({
  source,
  sources,
  editing,
  editPending,
  onStartEdit,
  onAskDelete,
  onEditSubmit,
  onEditNameChange,
  onCancelEdit,
}: SortableRootSourceProps) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: source.id,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const childSources = sources
    .filter((item) => item.parentId === source.id)
    .sort(compareSources);
  const isRootEditing = editing?.id === source.id;
  const editingName = isRootEditing ? editing!.name : "";
  const dragHandle = !isRootEditing ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing -ml-1.5"
      aria-label={t("income_sources.aria.reorder")}
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
        "group rounded-md border p-3 transition-colors",
        isDragging && "shadow-lg ring-1 ring-primary/30"
      )}
    >
      <div className="flex items-start gap-2">
        {dragHandle && dragHandle}
        {isRootEditing ? (
          <form onSubmit={onEditSubmit} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <Input value={editingName} onChange={onEditNameChange} autoFocus placeholder="Название источника" />
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={editPending} disabled={!editingName.trim()}>
                Сохранить
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={onCancelEdit} disabled={editPending}>
                Отмена
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-1 items-center gap-2">
            <span className="flex-1 font-medium">{source.name}</span>
            <div className="flex items-center gap-1 opacity-50 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Редактировать"
                onClick={() => onStartEdit(source)}
              >
                <PenLine className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Удалить"
                onClick={() => onAskDelete(source)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        )}
      </div>
      {childSources.length ? (
        <div className="mt-2 pl-4 grid gap-1">
          {childSources.map((child) => {
            const isChildEditing = editing?.id === child.id;
            const childEditingName = isChildEditing ? editing!.name : "";
            return (
              <div
                key={child.id}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/20"
              >
                {isChildEditing ? (
                  <form onSubmit={onEditSubmit} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                    <Input
                      value={childEditingName}
                      onChange={onEditNameChange}
                      autoFocus
                      placeholder="Название источника"
                    />
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" loading={editPending} disabled={!childEditingName.trim()}>
                        Сохранить
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={onCancelEdit} disabled={editPending}>
                        Отмена
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
                        aria-label="Редактировать"
                        onClick={() => onStartEdit(child)}
                      >
                        <PenLine className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="Удалить"
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
