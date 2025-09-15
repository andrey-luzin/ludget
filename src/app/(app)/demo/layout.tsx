import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Демо",
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children as React.ReactElement;
}
