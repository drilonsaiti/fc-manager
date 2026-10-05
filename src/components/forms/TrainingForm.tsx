"use client";
import { useState, type FormEvent } from "react";
import { Field } from "@/components/ui/Field";
import { defaultKickoff, fromLocalInput, toLocalInput } from "@/lib/utils/datetime";
import type { TrainingInput } from "@/lib/db/trainings";
import type { Training, TrainingKind } from "@/types";

const KINDS: { id: TrainingKind; label: string }[] = [
  { id: "fitness", label: "Fitness" }, { id: "technical", label: "Technical" }, { id: "tactical", label: "Tactical" },
  { id: "match_practice", label: "Match practice" }, { id: "other", label: "Other" },
];

export function TrainingForm({ initial, onSubmit, onCancel }: {
  initial?: Training;
  onSubmit: (input: TrainingInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [when, setWhen] = useState(toLocalInput(initial?.startsAt ?? defaultKickoff()));
  const [location, setLocation] = useState(initial?.location ?? "");
  const [kind, setKind] = useState<TrainingKind | "">(initial?.kind ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const startsAt = fromLocalInput(when);
    if (!startsAt) return setError("Pick a date and time.");
    setBusy(true);
    setError("");
    try {
      await onSubmit({ startsAt, location, kind: kind || null, notes: notes || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="When"><input className="input-field" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} autoFocus /></Field>
      <Field label="Where"><input className="input-field" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={80} /></Field>
      <Field label="Focus (optional)">
        <select className="input-field" value={kind} onChange={(e) => setKind(e.target.value as TrainingKind | "")}>
          <option value="">—</option>
          {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
      </Field>
      <Field label="Notes (optional)"><textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></Field>
      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary disabled:opacity-60" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
