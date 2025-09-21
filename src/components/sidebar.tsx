"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/auth-context";

const navItems = [
  { href: "/", label: "Транзакции", emoji: "🧾" },
];

const directoriesItems = [
  { href: "/directories/accounts", label: "Счета", emoji: "🏦" },
  { href: "/directories/currencies", label: "Валюты", emoji: "💱" },
  { href: "/directories/categories", label: "Категории", emoji: "🏷️" },
  { href: "/directories/income-sources", label: "Источники", emoji: "💼" },
];

const settingsItems = [
  { href: "/settings/sharing", label: "Совместное использование" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const [directoriesOpen, setDirectoriesOpen] = useState(true);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

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
          const active = isActive(item.href);
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
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60"
            onClick={() => setDirectoriesOpen((v) => !v)}
          >
            <span className="flex items-center gap-2">
              <span aria-hidden>📚</span>
              <span>Справочники</span>
            </span>
            {directoriesOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {directoriesOpen ? (
            <div className="ml-2 flex flex-col gap-1">
              {directoriesItems.map((item) => {
                const active = isActive(item.href);
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
      <div className="mt-auto pt-4 space-y-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-between text-sm font-medium text-muted-foreground"
            >
              <span className="flex items-center gap-2">
                <span aria-hidden>⚙️</span>
                <span>Настройки</span>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="end"
            sideOffset={1}
            className="w-60 border-muted-foreground/20 origin-bottom-left"
          >
            {settingsItems.map((item) => {
              const active = isActive(item.href);
              return (
                <DropdownMenuItem key={item.href} asChild>
                  <Link
                    href={item.href}
                    className={
                      "flex w-full items-center rounded-sm px-3 py-2 text-sm transition-colors " +
                      (active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60")
                    }
                  >
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" className="w-full" onClick={handleLogout}>
          Выйти
        </Button>
      </div>
    </aside>
  );
}
