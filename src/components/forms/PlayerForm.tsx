"use client";
import { useState, type FormEvent } from "react";
import { Field } from "@/components/ui/Field";
import { POSITIONS } from "@/constants/positions";
import type { PlayerInput } from "@/lib/db/players";
import type { Player } from "@/types";

export function PlayerForm({ initial, onSubmit, onCancel }: {
  initial?: Player;
  onSubmit: (input: PlayerInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [number, setNumber] = useState(initial?.number != null ? String(initial.number) : "");
  const [position, setPosition] = useState(initial?.positions[0] ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = number.trim() === "" ? null : Number(number);
    if (!name.trim()) return setError("Enter a name.");
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 99)) return setError("Shirt number must be 0–99.");
    setBusy(true);
    setError("");
    try {
      await onSubmit({ name, number: n, positions: position ? [position] : [], phone: phone || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name"><input className="input-field" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Shirt number"><input className="input-field" inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} /></Field>
        <Field label="Position">
          <select className="input-field" value={position} onChange={(e) => setPosition(e.target.value)}>
            <option value="">—</option>
            {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Phone (optional)" hint="Only the coaching staff can see this."><input className="input-field" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary disabled:opacity-60" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
