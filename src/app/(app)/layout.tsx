import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { Title } from "@/components/title";

export const metadata: Metadata = {
  title: "Ludget",
};

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppShell>
      <Title titleKey="nav.transactions" />
      {children}
    </AppShell>
  );
}
