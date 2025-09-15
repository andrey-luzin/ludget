import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Вход",
  robots: { index: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children as React.ReactElement;
}
