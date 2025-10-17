/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect } from "react";
import { useI18n } from "@/contexts/i18n-context";
import { usePathname } from "next/navigation";

export function Title({ titleKey, suffix = " — Ludget" }: { titleKey: string; suffix?: string }) {
  const { t } = useI18n();
  const pathname = usePathname() || "/";

  useEffect(() => {
    if (typeof document !== "undefined") {
      const title = t(titleKey);
      document.title = title + suffix;
    }
  }, [pathname, titleKey, suffix]);
  return null;
}

