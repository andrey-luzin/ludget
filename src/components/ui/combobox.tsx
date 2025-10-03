"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
  keywords?: string[];
  className?: string;
  style?: CSSProperties;
};

export type ComboboxProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
};

export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder = "Выберите...",
  searchPlaceholder = "Поиск...",
  emptyMessage = "Ничего не найдено",
  disabled = false,
  triggerClassName,
  contentClassName,
}: ComboboxProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [contentWidth, setContentWidth] = useState<number>();
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const selectedOption = useMemo(() => options.find((opt) => opt.value === value) ?? null, [options, value]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      const haystack = [opt.label, ...(opt.keywords ?? [])].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (filteredOptions.length === 0) {
      setHighlightedIndex(-1);
      return;
    }
    setHighlightedIndex((idx) => {
      if (idx < 0) return 0;
      if (idx >= filteredOptions.length) return filteredOptions.length - 1;
      return idx;
    });
  }, [filteredOptions]);

  useEffect(() => {
    const updateWidth = () => {
      if (triggerRef.current) {
        setContentWidth(triggerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        if (selectedOption) {
          const idx = filteredOptions.findIndex((opt) => opt.value === selectedOption.value);
          if (idx >= 0) {
            setHighlightedIndex(idx);
            return;
          }
        }
        setHighlightedIndex(filteredOptions.length > 0 ? 0 : -1);
      });
    } else {
      setQuery("");
      setHighlightedIndex(-1);
    }
  }, [open, filteredOptions, selectedOption]);

  useEffect(() => {
    if (highlightedIndex >= 0) {
      listRef.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setOpen(false);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((idx) => {
        if (filteredOptions.length === 0) return -1;
        const next = Math.min(idx + 1, filteredOptions.length - 1);
        return next < 0 ? 0 : next;
      });
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((idx) => {
        if (filteredOptions.length === 0) return -1;
        if (idx <= 0) return filteredOptions.length - 1;
        return idx - 1;
      });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (highlightedIndex >= 0) {
        const option = filteredOptions[highlightedIndex];
        if (option) {
          handleSelect(option.value);
        }
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  };

  const contentId = id ? `${id}-content` : undefined;

  return (
    <Popover open={open} onOpenChange={(next) => setOpen(!disabled && next)}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={contentId}
          id={id}
          disabled={disabled}
          className={cn("justify-between", triggerClassName)}
          onKeyDown={handleTriggerKeyDown}
        >
          {selectedOption ? (
            <span className="flex-1 truncate text-left">{selectedOption.label}</span>
          ) : (
            <span className="flex-1 truncate text-left text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        id={contentId}
        aria-labelledby={id}
        className={cn("p-0", contentClassName)}
        align="start"
        style={contentWidth ? { width: contentWidth } : undefined}
      >
        <div className="border-b p-2">
          <Input
            ref={inputRef}
            placeholder={searchPlaceholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlightedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            className="h-8"
          />
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>
          ) : (
            (() => {
              listRef.current = new Array(filteredOptions.length).fill(null);
              return filteredOptions.map((option, index) => {
                const isSelected = selectedOption?.value === option.value;
                const isHighlighted = highlightedIndex === index;
                return (
                  <button
                    key={option.value}
                    type="button"
                    ref={(node) => {
                      listRef.current[index] = node;
                    }}
                    className={cn(
                      "flex w-full cursor-pointer select-none items-center gap-2 px-2 py-1.5 text-sm",
                      isHighlighted && "bg-muted",
                      option.className
                    )}
                    style={option.style}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => handleSelect(option.value)}
                    title={option.label}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="flex min-w-0 flex-col text-left">
                        <span className="truncate">{option.label}</span>
                      </span>
                    </span>
                    <Check className={cn("h-4 w-4 text-primary transition-opacity", isSelected ? "opacity-100" : "opacity-0")} />
                  </button>
                );
              });
            })()
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
