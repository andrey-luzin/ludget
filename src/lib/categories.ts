import type { Category } from "@/types/entities";

export function buildCategoryIndex(categories: Category[]) {
  const byId = new Map<string, Category>();
  for (const c of categories) byId.set(c.id, c);

  const childrenOf = new Map<string | null, Category[]>();
  for (const c of categories) {
    const parentKey = c.parentId && byId.has(c.parentId) ? c.parentId : null;
    const arr = childrenOf.get(parentKey) ?? [];
    arr.push(c);
    childrenOf.set(parentKey, arr);
  }
  const sort = (a: Category, b: Category) => {
    const ao = a.order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name, "ru", { sensitivity: "base" });
  };
  for (const [k, arr] of childrenOf) childrenOf.set(k, arr.sort(sort));

  const ordered: Category[] = [];
  const roots = childrenOf.get(null) ?? [];
  const visit = (c: Category) => {
    ordered.push(c);
    const kids = childrenOf.get(c.id) ?? [];
    for (const ch of kids) visit(ch);
  };
  for (const r of roots) visit(r);

  const rootIds = roots.map((r) => r.id);

  return { ordered, byId, childrenOf, rootIds } as const;
}

export function getDescendants(id: string, childrenOf: Map<string | null, Category[]>) {
  const out: string[] = [];
  const walk = (x: string) => {
    const kids = childrenOf.get(x) ?? [];
    for (const k of kids) {
      out.push(k.id);
      walk(k.id);
    }
  };
  walk(id);
  return out;
}

export function depthOf(id: string, byId: Map<string, Category>) {
  let depth = 0;
  let cur = byId.get(id);
  const guard = new Set<string>();
  while (cur?.parentId && !guard.has(cur.parentId)) {
    guard.add(cur.parentId);
    depth += 1;
    cur = byId.get(cur.parentId);
  }
  return depth;
}

