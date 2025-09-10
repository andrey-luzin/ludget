import Sidebar from "@/components/sidebar";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen w-full flex">
      <Sidebar />
      <main className="flex-1 min-w-0 p-6 sm:p-10">{children}</main>
    </div>
  );
}

