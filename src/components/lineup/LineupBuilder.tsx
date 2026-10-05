"use client";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Copy, RotateCcw, Save, UserMinus, ArrowDownToLine } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLineup } from "@/hooks/data";
import { getLineup, listLineupSources, saveLineup, type LineupSource } from "@/lib/db/lineup";
import { friendlyError } from "@/lib/db/util";
import { PRESET_FORMATIONS, getFormation, parseFormation } from "@/features/lineup/formations";
import {
  benchPlayer, changeFormation, emptyLineup, fromEntries, keepOnly, movePlayer, placePlayer, playerIds,
  positionOf, removePlayer, resetLineup, resetPositions, startersOf, toEntries, validateLineup,
  type LineupState,
} from "@/features/lineup/lineup";
import { Pitch } from "./Pitch";
import { cn } from "@/lib/utils/cn";
import type { AvailabilityState, Player } from "@/types";

type Selection = { kind: "slot"; id: string } | { kind: "player"; id: string } | null;

const DOT: Record<AvailabilityState, string> = { yes: "bg-green-500", maybe: "bg-amber-400", none: "bg-pitch-500", no: "bg-red-500" };
const RANK: Record<AvailabilityState, number> = { yes: 0, maybe: 1, none: 2, no: 3 };
const surname = (name: string) => name.trim().split(/\s+/).slice(-1)[0];

export function LineupBuilder({ matchId, players, availability, readOnly }: {
  matchId: string;
  players: Player[];
  availability: Map<string, AvailabilityState>;
  readOnly: boolean;
}) {
  const { team, canManage } = useAuth();
  const { lineup, loading, mutate } = useLineup(matchId);
  const editable = canManage && !readOnly;

  const [draft, setDraft] = useState<LineupState | null>(null);
  const [sel, setSel] = useState<Selection>(null);
  const [message, setMessage] = useState("");
  const [sources, setSources] = useState<LineupSource[] | null>(null);
  const [saving, setSaving] = useState(false);

  // Saved state is the base; `draft` holds unsaved edits.
  const saved = useMemo(() => (lineup ? fromEntries(lineup.formation, lineup.entries) : emptyLineup()), [lineup]);
  const state = draft ?? saved;
  const dirty = draft !== null;

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const activeIds = useMemo(() => new Set(players.filter((p) => p.active).map((p) => p.id)), [players]);
  const nameOf = (id: string) => byId.get(id)?.name ?? "Unknown";

  const issues = useMemo(() => validateLineup(state, {
    activeIds, names: new Map(players.map((p) => [p.id, p.name])), availability,
  }), [state, activeIds, players, availability]);

  const inLineup = new Set(playerIds(state));
  const pool = players.filter((p) => p.active && !inLineup.has(p.id))
    .sort((a, b) => RANK[availability.get(a.id) ?? "none"] - RANK[availability.get(b.id) ?? "none"] || a.name.localeCompare(b.name));

  function edit(fn: (s: LineupState) => LineupState) { setDraft(fn(state)); setMessage(""); }

  // ── tap-to-assign ──────────────────────────────────────────────
  function tapSlot(slotId: string) {
    if (!editable) return;
    if (sel?.kind === "player") { edit((s) => placePlayer(s, slotId, sel.id)); setSel(null); return; }
    if (sel?.kind === "slot" && sel.id !== slotId && state.slots[sel.id] && !state.slots[slotId]) {
      // move a starter into an empty slot
      edit((s) => placePlayer(s, slotId, s.slots[sel.id])); setSel(null); return;
    }
    setSel(sel?.kind === "slot" && sel.id === slotId ? null : { kind: "slot", id: slotId });
  }

  function tapPlayer(id: string) {
    if (!editable) return;
    if (sel?.kind === "slot") { edit((s) => placePlayer(s, sel.id, id)); setSel(null); return; }
    setSel(sel?.kind === "player" && sel.id === id ? null : { kind: "player", id });
  }

  // ── drag a starter around the pitch ────────────────────────────
  const pitchRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ slotId: string; startX: number; startY: number; moved: boolean } | null>(null);

  function onPointerDown(e: React.PointerEvent, slotId: string) {
    if (!editable || !state.slots[slotId]) return;
    drag.current = { slotId, startX: e.clientX, startY: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current, rect = pitchRef.current?.getBoundingClientRect();
    if (!d || !rect) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 8) return;
    d.moved = true;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setDraft((cur) => movePlayer(cur ?? saved, d.slotId, x, y));
  }
  function onPointerUp(slotId: string) {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) tapSlot(slotId);
  }

  // ── actions ────────────────────────────────────────────────────
  async function save() {
    if (!team) return;
    if (issues.errors.length) return setMessage(issues.errors[0].message);
    setSaving(true);
    try {
      await saveLineup(matchId, state.formation, toEntries(state));
      await mutate();
      setDraft(null);
      setMessage("Lineup saved");
    } catch (e) { setMessage(friendlyError(e)); } finally { setSaving(false); }
  }

  async function openSources() {
    if (!team) return;
    try { setSources(await listLineupSources(team.id, matchId)); } catch (e) { setMessage(friendlyError(e)); }
  }

  async function duplicate(src: LineupSource) {
    try {
      const l = await getLineup(src.matchId);
      if (!l) return;
      setDraft(keepOnly(fromEntries(l.formation, l.entries), activeIds));
      setSources(null);
      setMessage(`Copied from ${src.opponent}. Check it, then save.`);
    } catch (e) { setMessage(friendlyError(e)); }
  }

  const [customFormation, setCustomFormation] = useState("");

  if (loading) return <p className="text-sm text-pitch-400">Loading lineup…</p>;

  const selectedStarter = sel?.kind === "slot" ? state.slots[sel.id] : undefined;
  const selectedBench = sel?.kind === "player" && state.bench.includes(sel.id) ? sel.id : undefined;
  const placed = startersOf(state);

  return (
    <section className="space-y-4" aria-label="Lineup">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input-field !w-auto !py-2" aria-label="Formation" disabled={!editable} value={state.formation}
          onChange={(e) => edit((s) => changeFormation(s, e.target.value))}>
          {!PRESET_FORMATIONS.includes(state.formation as never) && <option value={state.formation}>{state.formation}</option>}
          {PRESET_FORMATIONS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        {editable && (
          <>
            <input className="input-field !w-24 !py-2" placeholder="4-1-4-1" aria-label="Custom formation" value={customFormation}
              onChange={(e) => setCustomFormation(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && parseFormation(customFormation) && getFormation(customFormation)) { edit((s) => changeFormation(s, customFormation)); setCustomFormation(""); } }} />
            <button className="btn-ghost flex items-center gap-1.5" onClick={openSources}><Copy className="w-4 h-4" />Copy previous</button>
            <button className="btn-ghost flex items-center gap-1.5" onClick={() => { edit(resetPositions); }}>Reset spots</button>
            <button className="btn-ghost flex items-center gap-1.5" onClick={() => { edit(resetLineup); setSel(null); }}><RotateCcw className="w-4 h-4" />Clear</button>
          </>
        )}
      </div>

      <Pitch ref={pitchRef}>
        {getFormation(state.formation)?.slots.map((slot) => {
          const pid = state.slots[slot.id];
          const pos = positionOf(state, slot);
          const selected = sel?.kind === "slot" && sel.id === slot.id;
          const a = pid ? availability.get(pid) ?? "none" : null;
          return (
            <button key={slot.id} type="button" disabled={!editable && !pid}
              aria-label={pid ? `${slot.label}: ${nameOf(pid)}` : `Empty ${slot.label} slot`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, touchAction: pid && editable ? "none" : "auto" }}
              className={cn("absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 w-16 focus:outline-none",
                selected && "z-10")}
              onPointerDown={(e) => onPointerDown(e, slot.id)} onPointerMove={onPointerMove} onPointerUp={() => onPointerUp(slot.id)}
              onClick={(e) => { if (!pid || e.detail === 0) tapSlot(slot.id); }}>
              <span className={cn("relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-lg border-2 transition-transform",
                pid ? "bg-white text-black border-white" : "bg-black/30 text-white/80 border-dashed border-white/60",
                selected && "ring-4 ring-amber-400 scale-110")}>
                {pid ? (byId.get(pid)?.number ?? "•") : slot.label}
                {a && <span className={cn("absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border border-black", DOT[a])} />}
              </span>
              {pid && <span className="text-[11px] leading-tight font-medium text-white bg-black/50 rounded px-1 max-w-full truncate">{surname(nameOf(pid))}</span>}
            </button>
          );
        })}
      </Pitch>

      {/* Actions for the current selection */}
      {editable && (selectedStarter || selectedBench) && (
        <div className="surface-2 p-3 flex items-center gap-2 flex-wrap">
          <span className="text-sm flex-1 min-w-0 truncate">{nameOf((selectedStarter ?? selectedBench)!)}</span>
          {selectedStarter && (
            <button className="btn-ghost flex items-center gap-1.5" onClick={() => { edit((s) => benchPlayer(s, selectedStarter)); setSel(null); }}>
              <ArrowDownToLine className="w-4 h-4" />To bench
            </button>
          )}
          <button className="btn-ghost flex items-center gap-1.5 text-red-400" onClick={() => { edit((s) => removePlayer(s, (selectedStarter ?? selectedBench)!)); setSel(null); }}>
            <UserMinus className="w-4 h-4" />Remove
          </button>
          {selectedStarter && <span className="text-xs text-pitch-500 w-full">Tap a player below to replace, or drag on the pitch to move.</span>}
        </div>
      )}
      {editable && !selectedStarter && !selectedBench && (
        <p className="text-xs text-pitch-500">
          {sel?.kind === "player" ? `Now tap a spot on the pitch for ${nameOf(sel.id)}.` : "Tap a player, then a spot on the pitch. Tap a spot first to fill it. Drag a player to adjust."}
        </p>
      )}

      {/* Bench */}
      <div>
        <h3 className="text-xs uppercase tracking-widest text-pitch-500 mb-2">Bench ({state.bench.length})</h3>
        <div className="flex flex-wrap gap-2">
          {state.bench.length === 0 && <span className="text-xs text-pitch-500">Nobody on the bench.</span>}
          {state.bench.map((id) => (
            <Chip key={id} player={byId.get(id)} a={availability.get(id) ?? "none"} selected={sel?.kind === "player" && sel.id === id} onClick={() => tapPlayer(id)} />
          ))}
        </div>
      </div>

      {/* Remaining squad */}
      <div>
        <h3 className="text-xs uppercase tracking-widest text-pitch-500 mb-2">Squad ({pool.length})</h3>
        <div className="flex flex-wrap gap-2">
          {pool.map((p) => (
            <Chip key={p.id} player={p} a={availability.get(p.id) ?? "none"} selected={sel?.kind === "player" && sel.id === p.id} onClick={() => tapPlayer(p.id)}
              onBench={editable ? () => edit((s) => benchPlayer(s, p.id)) : undefined} />
          ))}
          {pool.length === 0 && <span className="text-xs text-pitch-500">Everyone is in the lineup.</span>}
        </div>
      </div>

      {(issues.errors.length > 0 || issues.warnings.length > 0) && (
        <ul className="space-y-1" aria-label="Lineup warnings">
          {[...issues.errors, ...issues.warnings].slice(0, 6).map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-amber-400"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{w.message}</li>
          ))}
        </ul>
      )}

      {editable && (
        <div className="sticky bottom-20 md:bottom-4 flex items-center gap-3">
          <button className="btn-primary flex items-center gap-2 py-3 px-5 disabled:opacity-50" disabled={!dirty || saving} onClick={save}>
            <Save className="w-4 h-4" />{saving ? "Saving…" : dirty ? "Save lineup" : "Saved"}
          </button>
          {dirty && <button className="btn-ghost" onClick={() => { setDraft(null); setSel(null); }}>Discard</button>}
          <span role="status" className="text-xs text-green-400">{message}</span>
        </div>
      )}
      {!editable && placed.length === 0 && <p className="text-sm text-pitch-400">No lineup has been set for this match.</p>}

      {sources && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70" onClick={() => setSources(null)}>
          <div className="bg-pitch-900 border border-pitch-700 rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">Copy lineup from…</h3>
            {sources.length === 0 && <p className="text-sm text-pitch-400">No saved lineups yet.</p>}
            {sources.map((s) => (
              <button key={s.matchId} className="w-full surface-2 p-3 text-left text-sm" onClick={() => duplicate(s)}>
                vs {s.opponent} <span className="text-pitch-500">· {s.kickoff.toLocaleDateString("en-GB")} · {s.formation}</span>
              </button>
            ))}
            <button className="btn-ghost w-full" onClick={() => setSources(null)}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}

function Chip({ player, a, selected, onClick, onBench }: {
  player: Player | undefined; a: AvailabilityState; selected: boolean; onClick: () => void; onBench?: () => void;
}) {
  if (!player) return null;
  return (
    <span className={cn("inline-flex items-stretch rounded-lg border text-sm overflow-hidden", selected ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/5")}>
      <button type="button" onClick={onClick} aria-pressed={selected} className="flex items-center gap-2 pl-2.5 pr-2.5 py-2">
        <span className={cn("w-2 h-2 rounded-full", DOT[a])} aria-hidden />
        {player.number != null && <span className="text-pitch-500 tabular-nums text-xs">{player.number}</span>}
        <span>{player.name}</span>
      </button>
      {onBench && <button type="button" aria-label={`Put ${player.name} on the bench`} onClick={onBench} className="px-2 border-l border-white/10 text-pitch-500 hover:text-white"><ArrowDownToLine className="w-3.5 h-3.5" /></button>}
    </span>
  );
}
