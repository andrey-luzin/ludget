"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { MQBreakpoint, useMediaQuery } from "@/hooks/use-media-query";

const navItems = [
  { href: "/", label: "Транзакции", emoji: "🧾" },
  { href: "/statistics", label: "Статистика", emoji: "📈" },
];

const directoriesItems = [
  { href: "/directories/accounts", label: "Счета", emoji: "🏦" },
  { href: "/directories/currencies", label: "Валюты", emoji: "💱" },
  { href: "/directories/categories", label: "Категории", emoji: "🏷️" },
  { href: "/directories/income-sources", label: "Источники", emoji: "💼" },
];

const settingsItems = [
  { href: "/settings/sharing", label: "Совместное использование" },
  { href: "/settings/preferences", label: "Персонализация" },
];

type SidebarProps = {
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
};

export default function Sidebar({ mobileOpen, onMobileOpenChange }: SidebarProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, user } = useAuth();
  const [directoriesOpen, setDirectoriesOpen] = useState(true);
  const isTablet = useMediaQuery(`(max-width: ${MQBreakpoint.Md - 1}px)`);
  const isMobile = useMediaQuery(`(max-width: ${MQBreakpoint.Sm - 1}px)`);
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);
  const isControlled = typeof mobileOpen === "boolean";
  const effectiveMobileOpen = isTablet ? (isControlled ? mobileOpen! : internalMobileOpen) : true;

  const setMobileOpen = useCallback(
    (next: boolean) => {
      if (isControlled) {
        onMobileOpenChange?.(next);
      } else {
        setInternalMobileOpen(next);
      }
    },
    [isControlled, onMobileOpenChange]
  );

  useEffect(() => {
    if (!isTablet) {
      setMobileOpen(true);
    } else if (!isControlled) {
      setMobileOpen(false);
    }
  }, [isControlled, isTablet, setMobileOpen]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const handleNavigate = () => {
    if (isTablet) {
      setMobileOpen(false);
    }
  };

  async function handleLogout() {
    await signOut();
    router.replace("/login");
    handleNavigate();
  }

  const sidebarClasses = useMemo(
    () =>
      cn(
        "flex h-full w-60 flex-col border-r bg-sidebar px-2.5 py-4 text-sidebar-foreground transition-transform lg:h-screen lg:w-58 lg:translate-x-0",
        isTablet
          ? [
              "fixed left-0 top-0 z-40 h-screen shadow-xl duration-200",
              effectiveMobileOpen ? "translate-x-0" : "-translate-x-full",
            ]
          : "sticky top-0",
      ),
    [effectiveMobileOpen, isTablet]
  );

  return (
    <>
      {isTablet && effectiveMobileOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/30"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      ) : null}
      <aside className={sidebarClasses} aria-hidden={isTablet && !effectiveMobileOpen}>
        <div className="flex items-center justify-between px-2 pb-4">
          <div className="text-lg font-semibold tracking-tight">Ludget</div>
          {isTablet ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(false)}
              aria-label="Скрыть меню"
              className="-mr-1"
            >
              <X className="h-5 w-5" />
            </Button>
          ) : null}
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
                onClick={handleNavigate}
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
                      onClick={handleNavigate}
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
                <span>{user?.email ?? "Аккаунт"}</span>
              </span>
            </Button>
          </DropdownMenuTrigger>
            <DropdownMenuContent
              side={!isMobile ? "right" : "top"}
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
                      onClick={handleNavigate}
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
    </>
  );
}
