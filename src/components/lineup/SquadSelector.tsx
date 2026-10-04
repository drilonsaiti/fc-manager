"use client";
import { useState, useEffect } from "react";
import { saveLineup, subscribeToLineup } from "@/lib/firebase/firestore";
import { useAvailability } from "@/hooks/useAvailability";
import { cn } from "@/lib/utils/cn";
import { Check, Star, Loader2 } from "lucide-react";
import type { User, Lineup } from "@/types";

const FORMATIONS = ["4-3-3","4-4-2","4-2-3-1","3-5-2","5-3-2","4-5-1"];

export function SquadSelector({ matchId, teamId, players }: {
  matchId: string; teamId: string; players: User[];
}) {
  const { summary } = useAvailability(matchId);
  const [formation, setFormation] = useState("4-3-3");
  const [squad, setSquad] = useState<string[]>([]);
  const [startingXI, setStartingXI] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const unsub = subscribeToLineup(matchId, (l) => {
      if (l) { setFormation(l.formation); setSquad(l.squad); setStartingXI(l.startingXI); }
    });
    return () => unsub();
  }, [matchId]);

  const availableIds = new Set(summary.yes.map((a) => a.userId));
  const availablePlayers = players.filter((p) => availableIds.has(p.id));

  const toggleSquad = (id: string) => {
    if (squad.includes(id)) {
      setSquad((p) => p.filter((x) => x !== id));
      setStartingXI((p) => p.filter((x) => x !== id));
    } else {
      setSquad((p) => [...p, id]);
    }
  };

  const toggleStarting = (id: string) => {
    if (!squad.includes(id)) return;
    if (startingXI.includes(id)) setStartingXI((p) => p.filter((x) => x !== id));
    else if (startingXI.length < 11) setStartingXI((p) => [...p, id]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveLineup(matchId, teamId, formation, squad, startingXI);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-pitch-400 mb-2 uppercase tracking-wide">Formation</label>
        <div className="flex flex-wrap gap-2">
          {FORMATIONS.map((f) => (
            <button key={f} onClick={() => setFormation(f)}
              className={cn("px-3 py-1.5 rounded-lg text-sm font-mono transition-all border",
                formation === f ? "bg-white text-black border-white" : "bg-pitch-800 text-pitch-400 border-pitch-700 hover:text-white")}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <span className="text-pitch-500">Squad: <span className="text-white">{squad.length}</span></span>
        <span className="text-pitch-500">Starting XI: <span className={cn(startingXI.length === 11 ? "text-green-400" : "text-white")}>{startingXI.length}/11</span></span>
      </div>

      {availablePlayers.length === 0 ? (
        <p className="text-pitch-600 text-sm text-center py-4">No players have confirmed availability yet.</p>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-3 gap-2 px-3 py-1 text-xs text-pitch-600 uppercase tracking-wide">
            <span>Player</span>
            <span className="text-center">Squad</span>
            <span className="text-center">XI</span>
          </div>
          {availablePlayers.map((player) => {
            const inSquad = squad.includes(player.id);
            const inStarting = startingXI.includes(player.id);
            return (
              <div key={player.id}
                className={cn("grid grid-cols-3 gap-2 items-center px-3 py-2.5 rounded-lg transition-colors",
                  inStarting ? "bg-green-500/10" : inSquad ? "bg-pitch-800" : "bg-pitch-900")}>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-pitch-700 flex items-center justify-center text-xs text-pitch-300 flex-shrink-0">
                    {player.jerseyNumber ?? player.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{player.name}</p>
                    <p className="text-xs text-pitch-500 truncate">{player.position ?? "—"}</p>
                  </div>
                </div>
                <div className="flex justify-center">
                  <button onClick={() => toggleSquad(player.id)}
                    className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-all",
                      inSquad ? "bg-white text-black" : "bg-pitch-700 text-pitch-500 hover:bg-pitch-600")}>
                    {inSquad && <Check className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex justify-center">
                  <button onClick={() => toggleStarting(player.id)} disabled={!inSquad}
                    className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-all",
                      inStarting ? "bg-amber-500 text-black" : inSquad ? "bg-pitch-700 text-pitch-500 hover:bg-pitch-600" : "opacity-30 cursor-not-allowed bg-pitch-900")}>
                    {inStarting && <Star className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button onClick={handleSave} disabled={saving || squad.length === 0}
        className={cn("btn-primary w-full flex items-center justify-center gap-2 py-3", saved && "bg-green-500 text-white hover:bg-green-500")}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <><Check className="w-4 h-4" /> Saved!</> : "Save Lineup"}
      </button>
    </div>
  );
}
