import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Валюты",
};

export default function CurrenciesLayout({ children }: { children: React.ReactNode }) {
  return children as React.ReactElement;
}
