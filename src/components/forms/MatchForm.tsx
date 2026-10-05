"use client";
import { useState, type FormEvent } from "react";
import { friendlyError } from "@/lib/db/util";
import { Field } from "@/components/ui/Field";
import { defaultKickoff, fromLocalInput, toLocalInput } from "@/lib/utils/datetime";
import type { MatchInput } from "@/lib/db/matches";
import { useT, type MessageKey } from "@/i18n";
import type { Competition, Match } from "@/types";

const COMPETITIONS: { id: Competition; label: MessageKey }[] = [
  { id: "league", label: "comp.league" }, { id: "cup", label: "comp.cup" },
  { id: "friendly", label: "comp.friendly" }, { id: "tournament", label: "comp.tournament" },
];

export function MatchForm({ initial, onSubmit, onCancel }: {
  initial?: Match;
  onSubmit: (input: MatchInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useT();
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
    if (!opponent.trim()) return setError(t("f.errOpponent"));
    if (!kickoff) return setError(t("f.errDate"));
    if (!Number.isInteger(minutes) || minutes < 10 || minutes > 150) return setError(t("f.errLength"));
    setBusy(true);
    setError("");
    try {
      await onSubmit({ opponent, kickoff, venue, competition, isHome, durationMinutes: minutes, notes: notes || null });
    } catch (err) {
      setError(friendlyError(err, t("f.errSave")));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t("f.opponent")}><input className="input-field" value={opponent} onChange={(e) => setOpponent(e.target.value)} maxLength={60} autoFocus /></Field>
      <Field label={t("f.kickoff")}><input className="input-field" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
      <Field label={t("f.venue")}><input className="input-field" value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={80} placeholder={t("f.venuePh")} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("f.competition")}>
          <select className="input-field" value={competition} onChange={(e) => setCompetition(e.target.value as Competition)}>
            {COMPETITIONS.map((c) => <option key={c.id} value={c.id}>{t(c.label)}</option>)}
          </select>
        </Field>
        <Field label={t("f.length")}>
          <input className="input-field" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[true, false].map((home) => (
          <button type="button" key={String(home)} onClick={() => setIsHome(home)} aria-pressed={isHome === home}
            className={`py-2.5 rounded-lg text-sm border ${isHome === home ? "bg-white text-black border-white" : "border-white/10 text-pitch-400"}`}>
            {home ? t("f.home") : t("f.away")}
          </button>
        ))}
      </div>
      <Field label={t("f.notes")}><textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></Field>
      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-ghost" onClick={onCancel}>{t("c.cancel")}</button>
        <button className="btn-primary disabled:opacity-60" disabled={busy}>{busy ? t("c.saving") : t("c.save")}</button>
      </div>
    </form>
  );
}
