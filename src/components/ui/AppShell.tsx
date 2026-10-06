"use client";
import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, CalendarDays, Dumbbell, Home, Settings, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "./LoadingSpinner";
import { cn } from "@/lib/utils/cn";
import { useT, type MessageKey } from "@/i18n";
import { LangSwitch } from "./LangSwitch";
import { TeamSwitcher } from "./TeamSwitcher";

const NAV: { href: string; label: MessageKey; icon: typeof Home }[] = [
  { href: "/dashboard", label: "nav.home", icon: Home },
  { href: "/matches", label: "nav.matches", icon: CalendarDays },
  { href: "/players", label: "nav.squad", icon: Users },
  { href: "/trainings", label: "nav.training", icon: Dumbbell },
  { href: "/stats", label: "nav.stats", icon: BarChart3 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useT();
  const { loading, userId, member, season } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (!loading && (!userId || !member)) router.replace("/login");
  }, [loading, userId, member, router]);

  if (loading || !userId || !member) return <PageLoader />;

  const active = (href: string) => path === href || path.startsWith(href + "/");

  return (
    <div className="min-h-dvh bg-pitch-950 md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 shrink-0 flex-col border-r border-white/10 p-4 gap-1 sticky top-0 h-dvh">
        <div className="mb-6 px-2">
          <TeamSwitcher />
          {season && <p className="text-xs text-pitch-500">{season.name}</p>}
        </div>
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
              active(href) ? "bg-white text-black font-medium" : "text-pitch-400 hover:text-white hover:bg-white/5")}>
            <Icon className="w-4 h-4" />{t(label)}
          </Link>
        ))}
        <Link href="/settings"
          className={cn("mt-auto flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
            active("/settings") ? "bg-white text-black font-medium" : "text-pitch-400 hover:text-white hover:bg-white/5")}>
          <Settings className="w-4 h-4" />{t("nav.settings")}
        </Link>
        <LangSwitch className="mt-2" />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 min-h-12 pt-[env(safe-area-inset-top)] border-b border-white/10 sticky top-0 bg-pitch-950/95 backdrop-blur z-30">
          <div className="min-w-0 flex-1 py-1">
            <TeamSwitcher />
            {season && <p className="text-[11px] leading-none text-pitch-500 -mt-0.5">{season.name}</p>}
          </div>
          <div className="flex items-center gap-1">
            <Link href="/settings" aria-label={t("nav.settings")} className="p-2 -mr-2 text-pitch-400 hover:text-white">
              <Settings className="w-5 h-5" />
            </Link>
          </div>
        </header>

        <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-5 pb-28 md:pb-10">{children}</main>

        {/* Mobile bottom navigation */}
        <nav aria-label={t("nav.main")} className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-pitch-950/95 backdrop-blur border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
          <ul className="grid grid-cols-5">
            {NAV.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link href={href} aria-current={active(href) ? "page" : undefined}
                  className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors",
                    active(href) ? "text-white" : "text-pitch-500")}>
                  <Icon className={cn("w-5 h-5", active(href) && "stroke-[2.5]")} />{t(label)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
