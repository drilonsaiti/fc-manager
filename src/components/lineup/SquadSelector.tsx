"use client";
import { useState, useEffect, useMemo } from "react";
import { saveLineup, subscribeToLineup } from "@/lib/firebase/firestore";
import { cn } from "@/lib/utils/cn";
import { Check, Star, Loader2 } from "lucide-react";
import type { AvailabilityRow } from "@/features/availability/logic";

const FORMATIONS = ["4-3-3","4-4-2","4-2-3-1","3-5-2","5-3-2","4-5-1"];

/**
 * Interim lineup picker (checkbox style). The visual pitch builder replaces it
 * next; it already works from the roster + availability rows.
 */
export function SquadSelector({ matchId, teamId, rows }: {
  matchId: string; teamId: string; rows: AvailabilityRow[];
}) {
  const [formation, setFormation] = useState("4-3-3");
  const [squad, setSquad] = useState<string[]>([]);
  const [startingXI, setStartingXI] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const unsub = subscribeToLineup(matchId, (l) => {
      if (l) { setFormation(l.formation); setSquad(l.squad); setStartingXI(l.startingXI); }
    });
    return () => unsub();
  }, [matchId]);

  const candidates = useMemo(() => {
    const rank = { yes: 0, maybe: 1, none: 2, no: 3 } as const;
    return [...rows]
      .filter((r) => showAll || r.status === "yes" || r.status === "maybe" || squad.includes(r.player.id))
      .sort((a, b) => rank[a.status] - rank[b.status]);
  }, [rows, showAll, squad]);

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
    setSaving(true); setError(false);
    try {
      await saveLineup(matchId, teamId, formation, squad, startingXI);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch {
      setError(true);
    } finally { setSaving(false); }
  };

  const statusLabel = { yes: "Available", maybe: "Maybe", none: "No response", no: "Unavailable" } as const;
  const statusColor = { yes: "text-green-400", maybe: "text-amber-400", none: "text-pitch-500", no: "text-red-400" } as const;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-pitch-400 mb-2 uppercase tracking-wide">Formation</label>
        <div className="flex flex-wrap gap-2">
          {FORMATIONS.map((f) => (
            <button key={f} onClick={() => setFormation(f)}
              className={cn("px-3 min-h-11 rounded-lg text-sm font-mono transition-all border",
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

      {candidates.length === 0 ? (
        <p className="text-pitch-600 text-sm text-center py-4">Nobody has said they can play yet.</p>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-[1fr_3rem_3rem] gap-2 px-3 py-1 text-xs text-pitch-600 uppercase tracking-wide">
            <span>Player</span><span className="text-center">Squad</span><span className="text-center">XI</span>
          </div>
          {candidates.map(({ player, status }) => {
            const inSquad = squad.includes(player.id);
            const inStarting = startingXI.includes(player.id);
            return (
              <div key={player.id}
                className={cn("grid grid-cols-[1fr_3rem_3rem] gap-2 items-center px-3 py-1.5 rounded-lg transition-colors",
                  inStarting ? "bg-green-500/10" : inSquad ? "bg-pitch-800" : "bg-pitch-900")}>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-pitch-700 flex items-center justify-center text-xs text-pitch-300 flex-shrink-0">
                    {player.number ?? player.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{player.name}</p>
                    <p className={cn("text-xs truncate", statusColor[status])}>{statusLabel[status]}</p>
                  </div>
                </div>
                <div className="flex justify-center">
                  <button onClick={() => toggleSquad(player.id)} aria-label={`${inSquad ? "Remove" : "Add"} ${player.name} ${inSquad ? "from" : "to"} squad`}
                    className={cn("w-11 h-11 rounded-lg flex items-center justify-center transition-all",
                      inSquad ? "bg-white text-black" : "bg-pitch-700 text-pitch-500 hover:bg-pitch-600")}>
                    {inSquad && <Check className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex justify-center">
                  <button onClick={() => toggleStarting(player.id)} disabled={!inSquad}
                    aria-label={`${inStarting ? "Remove" : "Start"} ${player.name}`}
                    className={cn("w-11 h-11 rounded-lg flex items-center justify-center transition-all",
                      inStarting ? "bg-amber-500 text-black" : inSquad ? "bg-pitch-700 text-pitch-500 hover:bg-pitch-600" : "opacity-30 cursor-not-allowed bg-pitch-900")}>
                    {inStarting && <Star className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button onClick={() => setShowAll((v) => !v)} className="text-sm text-pitch-500 underline underline-offset-2 min-h-11">
        {showAll ? "Show only available / maybe" : "Show everyone in the squad"}
      </button>

      {error && <p role="alert" className="text-sm text-red-400">Couldn&apos;t save the lineup. Try again.</p>}

      <button onClick={handleSave} disabled={saving || squad.length === 0}
        className={cn("btn-primary w-full flex items-center justify-center gap-2 py-3 min-h-12", saved && "bg-green-500 text-white hover:bg-green-500")}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <><Check className="w-4 h-4" /> Saved!</> : "Save Lineup"}
      </button>
    </div>
  );
}
