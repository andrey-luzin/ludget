import type { Metadata } from "next";
import { Title } from "@/components/title";

export const metadata: Metadata = {
  title: "Ludget",
  robots: { index: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Title titleKey="login.title" />
      {children as React.ReactElement}
    </>
  );
}
