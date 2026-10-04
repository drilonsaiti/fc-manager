"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { logOut } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils/cn";
import { LayoutDashboard, Calendar, Users, Dumbbell, User, LogOut, Shield, ChevronRight } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/matches",   label: "Matches",   icon: Calendar },
  { href: "/players",   label: "Players",   icon: Users },
  { href: "/trainings", label: "Training",  icon: Dumbbell },
  { href: "/profile",   label: "Profile",   icon: User },
];

const roleColor: Record<string, string> = {
  owner: "text-amber-400", coach: "text-blue-400",
  staff: "text-purple-400", player: "text-green-400",
};

export function Sidebar({ onNavClick, teamName }: { onNavClick?: () => void; teamName?: string }) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <aside className="flex flex-col w-64 md:w-56 h-screen bg-pitch-900 border-r border-pitch-800">
      <div className="p-5 border-b border-pitch-800 flex items-center gap-3">
        <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
          <Shield className="w-5 h-5 text-black" />
        </div>
        <p className="font-display text-xl text-white tracking-wider leading-none truncate">
          {teamName ?? "FC MANAGER"}
        </p>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link key={href} href={href} onClick={onNavClick}
              className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active ? "bg-white text-black" : "text-pitch-400 hover:text-white hover:bg-pitch-800")}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3 h-3" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-pitch-800">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-pitch-800 transition-colors">
          <div className="w-8 h-8 rounded-full bg-pitch-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {user?.photoURL
              ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
              : <span className="text-xs font-medium text-pitch-300">{user?.name?.charAt(0)?.toUpperCase()}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate font-medium">{user?.name}</p>
            <p className={cn("text-xs capitalize", roleColor[user?.role ?? "player"])}>{user?.role}</p>
          </div>
          <button onClick={() => logOut()} className="text-pitch-500 hover:text-red-400 transition-colors p-1" title="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
