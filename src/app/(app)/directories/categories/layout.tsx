import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Категории",
};

export default function CategoriesLayout({ children }: { children: React.ReactNode }) {
  return children as React.ReactElement;
}
