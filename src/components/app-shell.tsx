"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { MQBreakpoint, useMediaQuery } from "@/hooks/use-media-query";

export function AppShell({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(`(max-width: ${MQBreakpoint.Lg - 1}px)`);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) {
      setMobileSidebarOpen(true);
    } else {
      setMobileSidebarOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    if (isMobile && mobileSidebarOpen) {
      const previous = body.style.overflow;
      body.style.overflow = "hidden";
      return () => {
        body.style.overflow = previous;
      };
    }
    body.style.overflow = "";
    return () => {
      body.style.overflow = "";
    };
  }, [isMobile, mobileSidebarOpen]);

  return (
    <div className="relative flex min-h-screen w-full bg-muted/30">
      <Sidebar
        mobileOpen={isMobile ? mobileSidebarOpen : undefined}
        onMobileOpenChange={isMobile ? setMobileSidebarOpen : undefined}
      />
      <div className="flex min-h-screen flex-1 flex-col">
        {isMobile ? (
          <header className="sticky top-0 z-10 flex items-center border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Открыть меню"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </header>
        ) : null}
        <main className="min-w-0 flex-1 px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-6 lg:px-10 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
