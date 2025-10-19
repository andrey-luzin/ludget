"use client";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppAuthProvider from "@/contexts/auth-provider";
import { I18nProvider, useI18n } from "@/contexts/i18n-context";
import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { ThemeProvider } from "@/components/theme-provider";
import RegisterServiceWorker from "@/components/Pwa/RegisterServiceWorker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isLogin = pathname === "/login";

  useEffect(() => {
    if (loading) return;
    if (!user && !isLogin) {
      router.replace("/login");
    } else if (user && isLogin) {
      router.replace("/");
    }
  }, [loading, user, isLogin, router]);

  const wrapperClassName = 'min-h-screen flex items-center justify-center';

  // During loading or redirect, show a lightweight placeholder
  if (loading) {
    return (
      <div className={wrapperClassName}>
        <Spinner variant="ring" size="lg" aria-label="Loading" />
      </div>
    );
  }

  if ((!user && !isLogin) || (user && isLogin)) {
    return (
      <div className={wrapperClassName}>
        <Spinner variant="ring" size="lg" aria-label="Redirecting" />
      </div>
    );
  }

  return <>{children}</>;
}

function LangEffect({ children }: { children: React.ReactNode }) {
  const { lang } = useI18n();
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);
  return <>{children}</>;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <RegisterServiceWorker />
        <ThemeProvider>
          <AppAuthProvider>
            <I18nProvider>
              <LangEffect>
                <AuthGate>{children}</AuthGate>
              </LangEffect>
            </I18nProvider>
          </AppAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
