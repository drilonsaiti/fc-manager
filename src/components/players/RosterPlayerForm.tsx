"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { addRosterPlayer, updateRosterPlayer } from "@/lib/firebase/roster";
import { POSITIONS } from "@/constants/positions";
import { cn } from "@/lib/utils/cn";
import type { RosterPlayer } from "@/types";

export function RosterPlayerForm({ teamId, player, takenNumbers = [], onSuccess }: {
  teamId: string; player?: RosterPlayer; takenNumbers?: number[]; onSuccess: () => void;
}) {
  const [name, setName] = useState(player?.name ?? "");
  const [number, setNumber] = useState(player?.number?.toString() ?? "");
  const [primary, setPrimary] = useState(player?.positions[0] ?? "");
  const [others, setOthers] = useState<string[]>(player?.positions.slice(1) ?? []);
  const [phone, setPhone] = useState(player?.phone ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const num = number === "" ? null : Number(number);
  const numberTaken = num !== null && takenNumbers.includes(num) && num !== player?.number;

  const toggleOther = (p: string) =>
    setOthers((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const positions = [...(primary ? [primary] : []), ...others.filter((o) => o !== primary)];
      const input = { name, number: num, positions, phone: phone || null };
      if (player) await updateRosterPlayer(teamId, player.id, input);
      else await addRosterPlayer(teamId, input);
      onSuccess();
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    } finally { setLoading(false); }
  }

  async function setActive(active: boolean) {
    if (!player) return;
    setLoading(true);
    try { await updateRosterPlayer(teamId, player.id, { active }); onSuccess(); }
    catch { setError("Couldn't update. Try again."); }
    finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <div>
          <label htmlFor="rp-name" className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Name *</label>
          <input id="rp-name" className="input-field" value={name} onChange={(e) => setName(e.target.value)}
            required autoFocus={!player} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="rp-num" className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Shirt #</label>
          <input id="rp-num" type="number" inputMode="numeric" min={1} max={99} className="input-field"
            value={number} onChange={(e) => setNumber(e.target.value)} />
        </div>
      </div>
      {numberTaken && <p className="text-xs text-amber-400 -mt-2">Another player already wears #{num}.</p>}

      <div>
        <label htmlFor="rp-pos" className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Main position</label>
        <select id="rp-pos" className="input-field" value={primary} onChange={(e) => setPrimary(e.target.value)}>
          <option value="">— Not set —</option>
          {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div>
        <p className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Can also play</p>
        <div className="flex flex-wrap gap-1.5">
          {POSITIONS.filter((p) => p !== primary).map((p) => (
            <button type="button" key={p} aria-pressed={others.includes(p)} onClick={() => toggleOther(p)}
              className={cn("px-3 min-h-9 rounded-full text-xs border transition-colors",
                others.includes(p) ? "bg-white text-black border-white" : "border-pitch-700 text-pitch-400 hover:text-white")}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="rp-phone" className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Phone (optional)</label>
        <input id="rp-phone" type="tel" className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>

      {error && <p role="alert" className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

      <button type="submit" disabled={loading || !name.trim()} className="btn-primary w-full flex items-center justify-center gap-2 py-3 min-h-12">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {player ? "Save changes" : "Add player"}
      </button>

      {player && (
        <button type="button" disabled={loading} onClick={() => setActive(!player.active)}
          className="w-full text-sm text-pitch-500 hover:text-white min-h-11">
          {player.active ? "Remove from squad (keeps their history)" : "Bring back to squad"}
        </button>
      )}
    </form>
  );
}
