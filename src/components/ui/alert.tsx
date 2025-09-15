import * as React from "react";
import { cn } from "@/lib/utils";

export function Alert({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "destructive" }) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-md border p-3 text-sm",
        variant === "default" && "bg-accent text-accent-foreground",
        variant === "destructive" && "border-destructive/40 bg-destructive/10 text-destructive",
        className
      )}
      {...props}
    />
  );
}

