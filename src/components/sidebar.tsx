"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

const navItems = [
  { href: "/", label: "Бюджет", emoji: "💰" },
  { href: "/transactions", label: "Транзакции", emoji: "🧾" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();

  async function handleLogout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <aside className="h-screen sticky top-0 w-60 border-r bg-sidebar text-sidebar-foreground px-3 py-4">
      <div className="px-2 pb-4">
        <div className="text-lg font-semibold tracking-tight">ludget</div>
        <div className="text-xs text-muted-foreground">ведение бюджета</div>
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
      </nav>
      <div className="mt-auto pt-4">
        <Button variant="outline" className="w-full" onClick={handleLogout}>
          Выйти
        </Button>
      </div>
    </aside>
  );
}

