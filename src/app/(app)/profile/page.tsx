"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getPlayerStats, getTeam } from "@/lib/firebase/firestore";
import { logOut } from "@/lib/firebase/auth";
import { PlayerForm } from "@/components/players/PlayerForm";
import { StatsCard } from "@/components/ui/StatsCard";
import { PageLoader } from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/Badge";
import { LogOut, Target, Zap, Calendar, Shield } from "lucide-react";
import type { PlayerStat, Team } from "@/types";

export default function ProfilePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getPlayerStats(user.id),
      user.teamId ? getTeam(user.teamId) : Promise.resolve(null),
    ]).then(([s, t]) => { setStats(s); setTeam(t); setLoading(false); });
  }, [user]);

  if (!user || loading) return <PageLoader />;

  const totalGoals = stats.reduce((s, x) => s + x.goals, 0);
  const totalAssists = stats.reduce((s, x) => s + x.assists, 0);
  const matchesPlayed = stats.length;
  const isPlayer = user.role === "player";

  return (
    <div className="space-y-6 animate-fade-in max-w-lg mx-auto w-full">
      <h1 className="text-2xl font-display text-white tracking-wide">PROFILE</h1>

      <div className="surface p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-pitch-800 border-2 border-pitch-700 flex items-center justify-center overflow-hidden flex-shrink-0">
            {user.photoURL
              ? <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
              : <span className="text-2xl font-display text-pitch-300">{user.name.charAt(0).toUpperCase()}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-white">{user.name}</h2>
            <p className="text-pitch-500 text-sm">{user.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={user.role}>{user.role}</Badge>
              {user.position && <span className="text-xs text-pitch-500">{user.position}</span>}
              {user.jerseyNumber && <span className="text-xs text-pitch-600 font-mono">#{user.jerseyNumber}</span>}
            </div>
          </div>
        </div>

        {/* Players cannot edit their profile */}
        {!isPlayer && (
          !editing ? (
            <button onClick={() => setEditing(true)} className="btn-ghost w-full text-sm justify-center">
              Edit Profile
            </button>
          ) : (
            <div className="border-t border-pitch-800 pt-4">
              <PlayerForm player={user} onSuccess={() => setEditing(false)} />
              <button onClick={() => setEditing(false)} className="btn-ghost w-full text-sm mt-2">Cancel</button>
            </div>
          )
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-xs text-pitch-500 uppercase tracking-wider">Season Stats</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatsCard label="Goals" value={totalGoals} icon={Target} accent="green" />
          <StatsCard label="Assists" value={totalAssists} icon={Zap} accent="amber" />
          <StatsCard label="Apps" value={matchesPlayed} icon={Calendar} accent="blue" />
        </div>
      </div>

      {stats.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs text-pitch-500 uppercase tracking-wider">Performance History</h2>
          <div className="surface divide-y divide-pitch-800">
            {stats.slice(0, 8).map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className="text-sm text-pitch-400 font-mono">{s.matchId.slice(0, 8)}…</p>
                </div>
                <div className="flex gap-4 text-center">
                  <div><p className="text-white font-display text-base">{s.goals}</p><p className="text-pitch-600 text-xs">G</p></div>
                  <div><p className="text-white font-display text-base">{s.assists}</p><p className="text-pitch-600 text-xs">A</p></div>
                  <div><p className="text-white font-display text-base">{s.minutesPlayed}</p><p className="text-pitch-600 text-xs">min</p></div>
                  {s.rating && <div><p className="text-amber-400 font-display text-base">{s.rating}</p><p className="text-pitch-600 text-xs">rtg</p></div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-xs text-pitch-500 uppercase tracking-wider">Club</h2>
        <div className="surface p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-black" />
            </div>
            <p className="text-white font-medium">{team?.name ?? "Your Club"}</p>
          </div>
        </div>
      </div>

      <button onClick={() => logOut()}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-pitch-800 text-pitch-500 hover:text-red-400 hover:border-red-500/30 transition-all text-sm font-medium">
        <LogOut className="w-4 h-4" /> Sign Out
      </button>
    </div>
  );
}
