"use client";
import { useState, type FormEvent } from "react";
import { Field } from "@/components/ui/Field";
import { defaultKickoff, fromLocalInput, toLocalInput } from "@/lib/utils/datetime";
import type { TrainingInput } from "@/lib/db/trainings";
import { friendlyError } from "@/lib/db/util";
import { useT, type MessageKey } from "@/i18n";
import type { Training, TrainingKind } from "@/types";

const KINDS: { id: TrainingKind; label: MessageKey }[] = [
  { id: "fitness", label: "kind.fitness" }, { id: "technical", label: "kind.technical" }, { id: "tactical", label: "kind.tactical" },
  { id: "match_practice", label: "kind.match_practice" }, { id: "other", label: "kind.other" },
];

export function TrainingForm({ initial, onSubmit, onCancel }: {
  initial?: Training;
  onSubmit: (input: TrainingInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useT();
  const [when, setWhen] = useState(toLocalInput(initial?.startsAt ?? defaultKickoff()));
  const [location, setLocation] = useState(initial?.location ?? "");
  const [kind, setKind] = useState<TrainingKind | "">(initial?.kind ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const startsAt = fromLocalInput(when);
    if (!startsAt) return setError(t("f.errDate"));
    setBusy(true);
    setError("");
    try {
      await onSubmit({ startsAt, location, kind: kind || null, notes: notes || null });
    } catch (err) {
      setError(friendlyError(err, t("f.errSave")));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t("tf.when")}><input className="input-field" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} autoFocus /></Field>
      <Field label={t("tf.where")}><input className="input-field" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={80} /></Field>
      <Field label={t("tf.focus")}>
        <select className="input-field" value={kind} onChange={(e) => setKind(e.target.value as TrainingKind | "")}>
          <option value="">—</option>
          {KINDS.map((k) => <option key={k.id} value={k.id}>{t(k.label)}</option>)}
        </select>
      </Field>
      <Field label={t("f.notes")}><textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></Field>
      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-ghost" onClick={onCancel}>{t("c.cancel")}</button>
        <button className="btn-primary disabled:opacity-60" disabled={busy}>{busy ? t("c.saving") : t("c.save")}</button>
      </div>
    </form>
  );
}
