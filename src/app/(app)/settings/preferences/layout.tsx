import { Title } from "@/components/title";

export default function PreferencesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Title titleKey="nav.settings_preferences" />
      {children as React.ReactElement}
    </>
  );
}
