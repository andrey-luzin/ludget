"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

const navItems = [
  { href: "/", label: "Транзакции", emoji: "🧾" },
];

const settingsItems = [
  { href: "/settings/sharing", label: "Совместное использование", emoji: "👥" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(true);

  async function handleLogout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <aside className="h-screen sticky top-0 w-60 border-r bg-sidebar text-sidebar-foreground px-3 py-4 flex flex-col">
      <div className="px-2 pb-4">
        <div className="text-lg font-semibold tracking-tight">Ludget</div>
      </div>
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors " +
                (active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "hover:bg-sidebar-accent/60")
              }
            >
              <span aria-hidden>{item.emoji}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
        <div className="px-2 pt-3 pb-1 text-xs font-medium text-muted-foreground">Справочники</div>
        <div className="ml-1.5 flex flex-col gap-1">
          <Link
            href="/directories/accounts"
            className={
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors " +
              (pathname === "/directories/accounts"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "hover:bg-sidebar-accent/60")
            }
          >
            <span aria-hidden>🏦</span>
            <span>Счета</span>
          </Link>
          <Link
            href="/directories/currencies"
            className={
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors " +
              (pathname === "/directories/currencies"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "hover:bg-sidebar-accent/60")
            }
          >
            <span aria-hidden>💱</span>
            <span>Валюты</span>
          </Link>
          <Link
            href="/directories/categories"
            className={
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors " +
              (pathname === "/directories/categories"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "hover:bg-sidebar-accent/60")
            }
          >
            <span aria-hidden>🏷️</span>
            <span>Категории</span>
          </Link>
          <Link
            href="/directories/income-sources"
            className={
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors " +
              (pathname === "/directories/income-sources"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "hover:bg-sidebar-accent/60")
            }
          >
            <span aria-hidden>💼</span>
            <span>Источники</span>
          </Link>
        </div>
        <div className="ml-1.5 flex flex-col gap-1">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60"
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <span className="flex items-center gap-2">
              <span aria-hidden>⚙️</span>
              <span>Настройки</span>
            </span>
            {settingsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {settingsOpen ? (
            <div className="ml-2 flex flex-col gap-1">
              {settingsItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors " +
                      (active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "hover:bg-sidebar-accent/60")
                    }
                  >
                    <span aria-hidden>{item.emoji}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      </nav>
      <div className="mt-auto pt-4">
        <Button variant="outline" className="w-full" onClick={handleLogout}>
          Выйти
        </Button>
      </div>
    </aside>
  );
}
