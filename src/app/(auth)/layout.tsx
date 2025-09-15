import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Ludget",
    template: "%s — Ludget",
  },
};

export default function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  return children as React.ReactElement;
}

