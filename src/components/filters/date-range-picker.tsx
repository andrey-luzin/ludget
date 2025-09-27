"use client";

import { useEffect, useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfDay, startOfMonth } from "date-fns";
import { subDays } from "date-fns/subDays";
import { ru } from "date-fns/locale";

export type DateRange = { from?: Date; to?: Date };

export function DateRangePicker({
  value,
  onChange,
  triggerId,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
  triggerId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<DateRange>(value || {});

  useEffect(() => {
    if (open) setTemp(value || {});
  }, [open]);

  const label = useMemo(() => {
    const { from, to } = value || {};
    if (from && to) {
      const sameDay = startOfDay(from).getTime() === startOfDay(to).getTime();
      if (sameDay) return format(from, "dd.MM.yyyy");
      return `${format(from, "dd.MM.yyyy")} — ${format(to, "dd.MM.yyyy")}`;
    }
    if (from && !to) return `${format(from, "dd.MM.yyyy")} — …`;
    if (!from && to) return `… — ${format(to, "dd.MM.yyyy")}`;
    return "Все даты";
  }, [value]);

  function setPreset(preset: "day" | "weekSliding" | "monthSliding" | "yearSliding" | "sinceMonthStart") {
    const now = new Date();
    if (preset === "day") {
      const d = new Date();
      setTemp({ from: d, to: d });
    } else if (preset === "weekSliding") {
      setTemp({ from: startOfDay(subDays(now, 6)), to: now });
    } else if (preset === "monthSliding") {
      setTemp({ from: startOfDay(subDays(now, 29)), to: now });
    } else if (preset === "yearSliding") {
      setTemp({ from: startOfDay(subDays(now, 364)), to: now });
    } else if (preset === "sinceMonthStart") {
      setTemp({ from: startOfMonth(now), to: now });
    }
  }

  function clear() {
    setTemp({});
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={triggerId} variant="outline" className="min-w-56 justify-start">
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-3">
        <div className="flex flex-col md:flex-row gap-3">
          <Calendar
            mode="range"
            selected={{ from: temp.from, to: temp.to }}
            onSelect={(range: any) => setTemp(range || {})}
            numberOfMonths={2}
            defaultMonth={temp.from ?? value.from ?? new Date()}
            className="rounded-md"
            locale={ru}
          />
          <div className="w-48 md:w-56 grid gap-2">
            <div className="text-sm font-medium">Быстрый выбор</div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setPreset("day")}>За день</Button>
              <Button variant="secondary" onClick={() => setPreset("weekSliding")}>За неделю</Button>
              <Button variant="secondary" onClick={() => setPreset("monthSliding")}>За месяц</Button>
              <Button variant="secondary" onClick={() => setPreset("yearSliding")}>За год</Button>
              <Button variant="secondary" onClick={() => setPreset("sinceMonthStart")} className="col-span-2">С начала месяца</Button>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button variant="ghost" onClick={clear}>Сбросить</Button>
              <Button onClick={() => { onChange(temp || {}); setOpen(false); }}>Применить</Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

