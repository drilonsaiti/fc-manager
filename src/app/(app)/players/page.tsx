"use client";
import { useState } from "react";
import { Pencil, Plus, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers } from "@/hooks/data";
import { addPlayer, updatePlayer, type PlayerInput } from "@/lib/db/players";
import { friendlyError } from "@/lib/db/util";
import { PlayerForm } from "@/components/forms/PlayerForm";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoader } from "@/components/ui/LoadingSpinner";
import type { Player } from "@/types";

export default function PlayersPage() {
  const { team, canManage } = useAuth();
  const { players, loading, mutate } = usePlayers(team?.id);
  const [editing, setEditing] = useState<Player | "new" | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState("");

  if (loading) return <PageLoader />;
  const active = players.filter((p) => p.active).sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name));
  const inactive = players.filter((p) => !p.active);

  async function save(input: PlayerInput) {
    if (!team) return;
    if (editing === "new") await addPlayer(team.id, input);
    else if (editing) await updatePlayer(editing.id, input);
    await mutate();
    setEditing(null);
  }

  async function setActive(p: Player, activeNow: boolean) {
    try { await updatePlayer(p.id, { active: activeNow }); await mutate(); } catch (e) { setError(friendlyError(e)); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-wide">SQUAD <span className="text-pitch-500 text-xl">{active.length}</span></h1>
        {canManage && <button className="btn-primary flex items-center gap-1.5" onClick={() => setEditing("new")}><Plus className="w-4 h-4" />Add player</button>}
      </div>
      <p className="text-xs text-pitch-500">Players don&apos;t need accounts. They answer availability through the link you share.</p>
      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}

      {active.length === 0 && (
        <EmptyState icon={Users} title="Your squad is empty" description="Add your players — just names are enough."
          action={canManage ? <button className="btn-primary" onClick={() => setEditing("new")}>Add first player</button> : undefined} />
      )}

      <ul className="surface divide-y divide-white/5">
        {active.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3">
            <span className="w-7 text-center text-pitch-500 tabular-nums text-sm">{p.number ?? "–"}</span>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{p.name}</p>
              {p.positions[0] && <p className="text-xs text-pitch-500">{p.positions[0]}</p>}
            </div>
            {canManage && (
              <button aria-label={`Edit ${p.name}`} className="p-2 text-pitch-400 hover:text-white" onClick={() => setEditing(p)}><Pencil className="w-4 h-4" /></button>
            )}
          </li>
        ))}
      </ul>

      {inactive.length > 0 && (
        <div>
          <button className="text-xs text-pitch-500 underline" onClick={() => setShowInactive((v) => !v)}>
            {showInactive ? "Hide" : "Show"} archived ({inactive.length})
          </button>
          {showInactive && (
            <ul className="surface divide-y divide-white/5 mt-2">
              {inactive.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-pitch-400">
                  <span className="flex-1 text-sm truncate">{p.name}</span>
                  {canManage && <button className="btn-ghost" onClick={() => setActive(p, true)}>Restore</button>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add player" : "Edit player"}>
        {editing && (
          <>
            <PlayerForm initial={editing === "new" ? undefined : editing} onCancel={() => setEditing(null)} onSubmit={save} />
            {editing !== "new" && (
              <button className="mt-4 text-xs text-red-400 underline" onClick={async () => { await setActive(editing, false); setEditing(null); }}>
                Archive player (keeps their stats)
              </button>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
