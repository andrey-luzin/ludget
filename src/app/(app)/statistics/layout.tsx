import { Title } from "@/components/title";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ludget",
};

export default function StatisticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Title titleKey="nav.statistics" />
      {children}
    </>
  );
}
