import { Title } from "@/components/title";

export default function IncomeSourcesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Title titleKey="nav.income_sources" />
      {children as React.ReactElement}
    </>
  );
}
