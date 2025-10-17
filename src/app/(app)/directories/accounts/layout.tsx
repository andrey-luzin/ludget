import { Title } from "@/components/title";

export default function AccountsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Title titleKey="nav.accounts" />
      {children as React.ReactElement}
    </>
  );
}
