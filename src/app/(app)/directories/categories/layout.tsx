import { Title } from "@/components/title";

export default function CategoriesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Title titleKey="nav.categories" />
      {children as React.ReactElement}
    </>
  );
}
