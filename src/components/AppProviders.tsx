"use client";
import { useEffect, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { AuthProvider } from "@/contexts/AuthContext";
import { useLang } from "@/i18n";

/** Keeps <html lang> in step with the chosen language. */
function HtmlLang() {
  const lang = useLang();
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{
      dedupingInterval: 3000,
      focusThrottleInterval: 10_000,
      keepPreviousData: true,
      errorRetryCount: 2,
    }}>
      <HtmlLang />
      <AuthProvider>{children}</AuthProvider>
    </SWRConfig>
  );
}
