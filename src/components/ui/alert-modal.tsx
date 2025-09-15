"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type AlertModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: React.ReactNode;
  footer?: React.ReactNode;
};

export function AlertModal({ open, onOpenChange, title, description, footer }: AlertModalProps) {
  if (!open) return null;
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 grid place-items-center p-4",
        "bg-black/30 backdrop-blur-sm"
      )}
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-sm rounded-lg border bg-card text-card-foreground shadow-md"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="p-4 border-b">
          {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
          {description ? (
            <div className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{description}</div>
          ) : null}
        </div>
        <div className="p-4 flex items-center justify-end gap-2">
          {footer}
        </div>
      </div>
    </div>
  );
}

