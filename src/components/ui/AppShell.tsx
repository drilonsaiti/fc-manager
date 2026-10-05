"use client";
import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, CalendarDays, Dumbbell, Home, Settings, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "./LoadingSpinner";
import { cn } from "@/lib/utils/cn";

const NAV = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/matches", label: "Matches", icon: CalendarDays },
  { href: "/players", label: "Squad", icon: Users },
  { href: "/trainings", label: "Training", icon: Dumbbell },
  { href: "/stats", label: "Stats", icon: BarChart3 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { loading, userId, member, team, season } = useAuth();
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
          <p className="font-display text-2xl tracking-wide">{team?.name ?? "FC MANAGER"}</p>
          {season && <p className="text-xs text-pitch-500">{season.name}</p>}
        </div>
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
              active(href) ? "bg-white text-black font-medium" : "text-pitch-400 hover:text-white hover:bg-white/5")}>
            <Icon className="w-4 h-4" />{label}
          </Link>
        ))}
        <Link href="/settings"
          className={cn("mt-auto flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
            active("/settings") ? "bg-white text-black font-medium" : "text-pitch-400 hover:text-white hover:bg-white/5")}>
          <Settings className="w-4 h-4" />Settings
        </Link>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 h-12 border-b border-white/10 sticky top-0 bg-pitch-950/95 backdrop-blur z-30">
          <div className="min-w-0">
            <span className="font-display text-xl tracking-wide truncate">{team?.name ?? "FC MANAGER"}</span>
            {season && <span className="text-xs text-pitch-500 ml-2">{season.name}</span>}
          </div>
          <Link href="/settings" aria-label="Settings" className="p-2 -mr-2 text-pitch-400 hover:text-white">
            <Settings className="w-5 h-5" />
          </Link>
        </header>

        <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-5 pb-28 md:pb-10">{children}</main>

        {/* Mobile bottom navigation */}
        <nav aria-label="Main" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-pitch-950/95 backdrop-blur border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
          <ul className="grid grid-cols-5">
            {NAV.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link href={href} aria-current={active(href) ? "page" : undefined}
                  className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors",
                    active(href) ? "text-white" : "text-pitch-500")}>
                  <Icon className={cn("w-5 h-5", active(href) && "stroke-[2.5]")} />{label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
