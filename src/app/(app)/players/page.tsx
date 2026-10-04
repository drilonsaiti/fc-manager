"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers } from "@/hooks/usePlayers";
import { getTeamStats } from "@/lib/firebase/firestore";
import { PlayerCard } from "@/components/players/PlayerCard";
import { PlayerForm } from "@/components/players/PlayerForm";
import { AddMemberForm } from "@/components/players/AddMemberForm";
import { Modal } from "@/components/ui/Modal";
import { PageLoader } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatsCard } from "@/components/ui/StatsCard";
import { cn } from "@/lib/utils/cn";
import { Users, Search, Target, Zap, UserPlus } from "lucide-react";
import type { User, PlayerStat } from "@/types";

type View = "all" | "players" | "staff";

export default function PlayersPage() {
  const { user, canManage } = useAuth();
  const { players, allPlayers, staff, loading } = usePlayers(user?.teamId);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [view, setView] = useState<View>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<User | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (user?.teamId) getTeamStats(user.teamId).then(setStats);
  }, [user?.teamId]);

  if (loading) return <PageLoader />;

  const getPlayerStats = (playerId: string) => {
    const ps = stats.filter((s) => s.userId === playerId);
    return { goals: ps.reduce((s, x) => s + x.goals, 0), assists: ps.reduce((s, x) => s + x.assists, 0), matches: ps.length };
  };

  const displayed = (view === "players" ? allPlayers : view === "staff" ? staff : players)
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.position?.toLowerCase().includes(search.toLowerCase()));

  const totalGoals = stats.reduce((s, x) => s + x.goals, 0);
  const totalAssists = stats.reduce((s, x) => s + x.assists, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-white tracking-wide">PLAYERS</h1>
          <p className="text-pitch-500 text-sm mt-0.5">{allPlayers.length} players · {staff.length} staff</p>
        </div>
        {canManage && (
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5 text-sm">
            <UserPlus className="w-4 h-4" /> Add Member
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatsCard label="Squad Size" value={allPlayers.length} icon={Users} />
        <StatsCard label="Team Goals" value={totalGoals} icon={Target} accent="green" />
        <StatsCard label="Assists" value={totalAssists} icon={Zap} accent="amber" />
      </div>

      <div className="flex border border-pitch-800 rounded-lg overflow-hidden p-1 gap-1 w-fit">
        {(["all","players","staff"] as View[]).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all capitalize",
              view === v ? "bg-white text-black" : "text-pitch-400 hover:text-white")}>
            {v} <span className="text-xs opacity-60">({v === "players" ? allPlayers.length : v === "staff" ? staff.length : players.length})</span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pitch-600" />
        <input className="input-field pl-9" placeholder="Search by name or position..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {displayed.length === 0 ? (
        <EmptyState icon={Users}
          title={search ? "No players found" : canManage ? "No members yet" : "No players found"}
          description={search ? "Try a different search term." : canManage ? "Add your first player or staff member." : "Players will appear here once added by a manager."}
          action={!search && canManage
            ? <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5 text-sm"><UserPlus className="w-4 h-4" /> Add First Member</button>
            : undefined}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {displayed.map((p) => (
            <PlayerCard key={p.id} player={p} stats={getPlayerStats(p.id)}
              onClick={canManage ? () => setSelected(p) : undefined} />
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Player or Staff" size="md">
        <AddMemberForm onSuccess={() => setShowAdd(false)} />
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Edit Profile">
        {selected && <PlayerForm player={selected} canEditRole={canManage} onSuccess={() => setSelected(null)} />}
      </Modal>
    </div>
  );
}
