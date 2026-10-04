"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getTeam } from "@/lib/firebase/firestore";
import { Sidebar } from "./Sidebar";
import { Menu, X, Shield } from "lucide-react";
import type { Team } from "@/types";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  // Depend only on teamId string — stable, won't re-fire on every snapshot
  useEffect(() => {
    if (!user?.teamId) return;
    getTeam(user.teamId).then((t) => setTeam(t));
  }, [user?.teamId]);

  // Close drawer on navigation
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-pitch-950 flex items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-pitch-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-dvh bg-pitch-950">
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-screen sticky top-0">
        <Sidebar teamName={team?.name} />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50">
            <Sidebar teamName={team?.name} onNavClick={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-pitch-800 bg-pitch-900 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-white rounded-md flex items-center justify-center">
              <Shield className="w-4 h-4 text-black" />
            </div>
            <span className="font-display text-lg text-white tracking-wider">
              {team?.name ?? "FC MANAGER"}
            </span>
          </div>
          <button onClick={() => setMobileOpen((v) => !v)}
            className="p-2 rounded-lg text-pitch-400 hover:text-white hover:bg-pitch-800 transition-colors">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
