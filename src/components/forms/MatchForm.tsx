"use client";
import { useState, type FormEvent } from "react";
import { Field } from "@/components/ui/Field";
import { defaultKickoff, fromLocalInput, toLocalInput } from "@/lib/utils/datetime";
import type { MatchInput } from "@/lib/db/matches";
import type { Competition, Match } from "@/types";

const COMPETITIONS: { id: Competition; label: string }[] = [
  { id: "league", label: "League" }, { id: "cup", label: "Cup" },
  { id: "friendly", label: "Friendly" }, { id: "tournament", label: "Tournament" },
];

export function MatchForm({ initial, onSubmit, onCancel }: {
  initial?: Match;
  onSubmit: (input: MatchInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [opponent, setOpponent] = useState(initial?.opponent ?? "");
  const [when, setWhen] = useState(toLocalInput(initial?.kickoff ?? defaultKickoff()));
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const [competition, setCompetition] = useState<Competition>(initial?.competition ?? "league");
  const [isHome, setIsHome] = useState(initial?.isHome ?? true);
  const [duration, setDuration] = useState(String(initial?.durationMinutes ?? 90));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const kickoff = fromLocalInput(when);
    const minutes = Number(duration);
    if (!opponent.trim()) return setError("Who are you playing?");
    if (!kickoff) return setError("Pick a date and time.");
    if (!Number.isInteger(minutes) || minutes < 10 || minutes > 150) return setError("Match length must be 10–150 minutes.");
    setBusy(true);
    setError("");
    try {
      await onSubmit({ opponent, kickoff, venue, competition, isHome, durationMinutes: minutes, notes: notes || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Opponent"><input className="input-field" value={opponent} onChange={(e) => setOpponent(e.target.value)} maxLength={60} autoFocus /></Field>
      <Field label="Kick-off"><input className="input-field" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
      <Field label="Venue"><input className="input-field" value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={80} placeholder="Pitch / address" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Competition">
          <select className="input-field" value={competition} onChange={(e) => setCompetition(e.target.value as Competition)}>
            {COMPETITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Length (minutes)">
          <input className="input-field" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[true, false].map((home) => (
          <button type="button" key={String(home)} onClick={() => setIsHome(home)} aria-pressed={isHome === home}
            className={`py-2.5 rounded-lg text-sm border ${isHome === home ? "bg-white text-black border-white" : "border-white/10 text-pitch-400"}`}>
            {home ? "Home" : "Away"}
          </button>
        ))}
      </div>
      <Field label="Notes (optional)"><textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></Field>
      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary disabled:opacity-60" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
