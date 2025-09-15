import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Источники дохода",
};

export default function IncomeSourcesLayout({ children }: { children: React.ReactNode }) {
  return children as React.ReactElement;
}
