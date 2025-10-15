"use client";

import * as React from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/entities";
import { useI18n } from "@/contexts/i18n-context";
import { buildCategoryIndex, getDescendants, depthOf } from "@/lib/categories";

export type CategoryMultiSelectProps = {
  value: string[];
  onChange: (next: string[]) => void;
  categories: Category[];
  placeholder?: string;
  triggerClassName?: string;
};

export function CategoryMultiSelect({ value, onChange, categories, placeholder, triggerClassName }: CategoryMultiSelectProps) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const { ordered, byId, childrenOf } = React.useMemo(() => buildCategoryIndex(categories), [categories]);

  const allIds = React.useMemo(() => ordered.map((c) => c.id), [ordered]);

  const selectedSet = React.useMemo(() => new Set(value), [value]);

  const toggle = (id: string, includeChildren = true) => {
    const next = new Set(selectedSet);
    const ids = includeChildren ? [id, ...getDescendants(id, childrenOf)] : [id];
    const shouldSelect = !ids.every((x) => next.has(x));
    ids.forEach((x) => {
      if (shouldSelect) next.add(x);
      else next.delete(x);
    });
    onChange(Array.from(next));
  };

  const clearAll = () => onChange([]);
  // Select all categories including subcategories
  const selectAll = () => onChange(allIds);

  const filteredIds = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allIds;
    return ordered
      .filter((c) => c.name.toLowerCase().includes(q) || (c.parentId && (byId.get(c.parentId)?.name.toLowerCase() || "").includes(q)))
      .map((c) => c.id);
  }, [query, ordered, byId, allIds]);

  const effectivePlaceholder = placeholder ?? t("stats.categories.placeholder");
  const label = React.useMemo(() => {
    if (value.length === 0) return effectivePlaceholder;
    if (value.length === 1) return byId.get(value[0])?.name ?? effectivePlaceholder;
    return t("stats.selected_count").replace("{{count}}", String(value.length));
  }, [value, byId, effectivePlaceholder, t]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={cn("justify-between", triggerClassName)}>
          <span className={cn("truncate", value.length ? "text-foreground" : "text-muted-foreground")}>{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0 w-96">
        <div className="border-b p-2 flex items-center gap-2">
          <Input
            placeholder={t("stats.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8"
          />
          <Button type="button" variant="ghost" size="sm" onClick={clearAll}>{t("stats.clear")}</Button>
          <Button type="button" variant="ghost" size="sm" onClick={selectAll}>{t("stats.all")}</Button>
        </div>
        <div className="max-h-72 overflow-y-auto py-1 text-sm">
          {ordered
            .filter((c) => filteredIds.includes(c.id))
            .map((c) => {
              const depth = depthOf(c.id, byId);
              const checked = selectedSet.has(c.id);
              const partially = !checked && childrenOf.get(c.id)?.some((ch) => selectedSet.has(ch.id));
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  className={cn("flex w-full cursor-pointer select-none items-center gap-2 px-2 py-1.5 hover:bg-muted")}
                  onClick={() => {
                    toggle(c.id, true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggle(c.id, true);
                    }
                  }}
                >
                  <span style={{ paddingLeft: Math.min(depth, 4) * 16 }} className="flex items-center gap-2">
                    <Checkbox checked={checked || partially} aria-checked={partially ? "mixed" : checked} onCheckedChange={() => toggle(c.id, true)} />
                    <span className="truncate">{c.name}</span>
                  </span>
                </div>
              );
            })}
          {filteredIds.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">{t("stats.nothing_found")}</div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
