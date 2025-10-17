import { Title } from "@/components/title";

export default function SharingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Title titleKey="nav.settings_sharing" />
      {children as React.ReactElement}
    </>
  );
}
