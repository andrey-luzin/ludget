"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ru, enUS } from "date-fns/locale";
import { useI18n } from "@/contexts/i18n-context";

export function DatePicker({
  value,
  onChange,
  triggerId,
  triggerClassName,
}: {
  value: Date;
  onChange: (d: Date) => void;
  triggerId?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const { lang } = useI18n();
  const locale = lang === "ru" ? ru : enUS;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={triggerId} variant="outline" className={cn("justify-start", triggerClassName)}>
          {value.toLocaleDateString()}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="p-2">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => d && (onChange(d), setOpen(false))}
          defaultMonth={value}
          locale={locale}
        />
      </PopoverContent>
    </Popover>
  );
}
