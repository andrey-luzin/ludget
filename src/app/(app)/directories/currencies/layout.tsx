import { Title } from "@/components/title";

export default function CurrenciesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Title titleKey="nav.currencies" />
      {children as React.ReactElement}
    </>
  );
}
