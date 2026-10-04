"use client";
import { useState } from "react";
import { format } from "date-fns";
import { createMatch, updateMatch } from "@/lib/firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import type { Match, Competition, MatchStatus } from "@/types";

export function MatchForm({ onSuccess, existing }: { onSuccess: () => void; existing?: Match }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    opponent: existing?.opponent ?? "",
    date: existing ? format(existing.date, "yyyy-MM-dd'T'HH:mm") : "",
    location: existing?.location ?? "",
    competition: existing?.competition ?? "league" as Competition,
    isHome: existing?.isHome ?? true,
    status: existing?.status ?? "upcoming" as MatchStatus,
    homeScore: existing?.homeScore?.toString() ?? "",
    awayScore: existing?.awayScore?.toString() ?? "",
    notes: existing?.notes ?? "",
  });

  const set = (key: string, value: unknown) => setForm((p) => ({ ...p, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.teamId) return;
    setError(""); setLoading(true);
    try {
      const data = {
        teamId: user.teamId,
        opponent: form.opponent,
        date: new Date(form.date),
        location: form.location,
        competition: form.competition,
        isHome: form.isHome,
        status: form.status,
        notes: form.notes || null,
        homeScore: form.homeScore !== "" ? Number(form.homeScore) : null,
        awayScore: form.awayScore !== "" ? Number(form.awayScore) : null,
      };
      if (existing) await updateMatch(existing.id, data);
      else await createMatch(data);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save match.");
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Opponent *</label>
        <input className="input-field" placeholder="e.g. FC Rivals" value={form.opponent} onChange={(e) => set("opponent", e.target.value)} required />
      </div>
      <div>
        <label className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Date & Time *</label>
        <input type="datetime-local" className="input-field" value={form.date} onChange={(e) => set("date", e.target.value)} required />
      </div>
      <div>
        <label className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Location *</label>
        <input className="input-field" placeholder="e.g. Main Stadium" value={form.location} onChange={(e) => set("location", e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Competition</label>
          <select className="input-field" value={form.competition} onChange={(e) => set("competition", e.target.value)}>
            <option value="league">League</option><option value="cup">Cup</option>
            <option value="friendly">Friendly</option><option value="tournament">Tournament</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Venue</label>
          <select className="input-field" value={form.isHome ? "home" : "away"} onChange={(e) => set("isHome", e.target.value === "home")}>
            <option value="home">Home</option><option value="away">Away</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Status</label>
        <select className="input-field" value={form.status} onChange={(e) => set("status", e.target.value)}>
          <option value="upcoming">Upcoming</option><option value="finished">Finished</option><option value="cancelled">Cancelled</option>
        </select>
      </div>
      {form.status === "finished" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Our Score</label>
            <input type="number" min="0" className="input-field" placeholder="0" value={form.homeScore} onChange={(e) => set("homeScore", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Their Score</label>
            <input type="number" min="0" className="input-field" placeholder="0" value={form.awayScore} onChange={(e) => set("awayScore", e.target.value)} />
          </div>
        </div>
      )}
      <div>
        <label className="block text-xs text-pitch-400 mb-1.5 uppercase tracking-wide">Notes</label>
        <textarea className="input-field resize-none" rows={2} placeholder="Optional notes..." value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
      </div>
      {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {existing ? "Update Match" : "Create Match"}
      </button>
    </form>
  );
}
