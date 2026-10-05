"use client";
import { useState, type FormEvent } from "react";
import { Field } from "@/components/ui/Field";
import { POSITIONS } from "@/constants/positions";
import type { PlayerInput } from "@/lib/db/players";
import { friendlyError } from "@/lib/db/util";
import { trDyn, useT } from "@/i18n";
import type { Player } from "@/types";

export function PlayerForm({ initial, onSubmit, onCancel }: {
  initial?: Player;
  onSubmit: (input: PlayerInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useT();
  const [name, setName] = useState(initial?.name ?? "");
  const [number, setNumber] = useState(initial?.number != null ? String(initial.number) : "");
  const [position, setPosition] = useState(initial?.positions[0] ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = number.trim() === "" ? null : Number(number);
    if (!name.trim()) return setError(t("pf.errName"));
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 99)) return setError(t("pf.errNumber"));
    setBusy(true);
    setError("");
    try {
      await onSubmit({ name, number: n, positions: position ? [position] : [], phone: phone || null });
    } catch (err) {
      setError(friendlyError(err, t("f.errSave")));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t("pf.name")}><input className="input-field" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("pf.number")}><input className="input-field" inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} /></Field>
        <Field label={t("pf.position")}>
          <select className="input-field" value={position} onChange={(e) => setPosition(e.target.value)}>
            <option value="">—</option>
            {POSITIONS.map((p) => <option key={p} value={p}>{trDyn(`pos.${p}`, p)}</option>)}
          </select>
        </Field>
      </div>
      <Field label={t("pf.phone")} hint={t("pf.phoneHint")}><input className="input-field" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-ghost" onClick={onCancel}>{t("c.cancel")}</button>
        <button className="btn-primary disabled:opacity-60" disabled={busy}>{busy ? t("c.saving") : t("c.save")}</button>
      </div>
    </form>
  );
}
