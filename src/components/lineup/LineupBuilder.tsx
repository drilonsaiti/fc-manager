"use client";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AlertTriangle, ArrowDownToLine, Copy, Download, RotateCcw, Save, Share2, Sparkles, UserMinus, Undo2, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLineup, useSeasonStats } from "@/hooks/data";
import { getLineup, listLineupSources, saveLineup, type LineupSource } from "@/lib/db/lineup";
import { friendlyError } from "@/lib/db/util";
import { PRESET_FORMATIONS, getFormation, parseFormation } from "@/features/lineup/formations";
import {
  benchPlayer, changeFormation, emptyLineup, fromEntries, keepOnly, movePlayer, placeNearest, placePlayer, playerIds,
  positionOf, removePlayer, resetLineup, resetPositions, startersOf, toEntries, validateLineup, type LineupState,
} from "@/features/lineup/lineup";
import { autoFill } from "@/features/lineup/autofill";
import { imageFileName, lineupImageBlob } from "@/features/lineup/image";
import { formatNumericDate } from "@/i18n/dates";
import { shortDate } from "@/lib/utils/datetime";
import { trDyn, useT } from "@/i18n";
import { Pitch } from "./Pitch";
import { useDrag, type DragItem, type DropTarget } from "./useDrag";
import { cn } from "@/lib/utils/cn";
import type { AvailabilityState, Match, Player } from "@/types";

type Selection = { kind: "slot"; id: string } | { kind: "player"; id: string } | null;

const DOT: Record<AvailabilityState, string> = { yes: "bg-green-500", maybe: "bg-amber-400", none: "bg-pitch-500", no: "bg-red-500" };
const RANK: Record<AvailabilityState, number> = { yes: 0, maybe: 1, none: 2, no: 3 };
const shortName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0]}.` : parts[0] ?? "?";
};
const noop = () => () => {};
const canShareFiles = () => typeof navigator !== "undefined" && typeof navigator.canShare === "function";

export function LineupBuilder({ match, teamName, players, availability, readOnly }: {
  match: Match;
  teamName: string;
  players: Player[];
  availability: Map<string, AvailabilityState>;
  readOnly: boolean;
}) {
  const matchId = match.id;
  const { t } = useT();
  const { team, canManage } = useAuth();
  const { lineup, loading, mutate } = useLineup(matchId);
  const editable = canManage && !readOnly;
  const shareable = useSyncExternalStore(noop, canShareFiles, () => false);

  const [draft, setDraft] = useState<LineupState | null>(null);
  const [sel, setSel] = useState<Selection>(null);
  const [message, setMessage] = useState("");
  const [sources, setSources] = useState<LineupSource[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [customFormation, setCustomFormation] = useState("");
  const [trayOpen, setTrayOpen] = useState(true);
  const [auto, setAuto] = useState<{ text: string; before: LineupState | null } | null>(null);
  const { data: seasonData } = useSeasonStats(team?.id, match.seasonId ?? undefined);

  // The saved lineup is the base; `draft` holds unsaved edits.
  const saved = useMemo(() => (lineup ? fromEntries(lineup.formation, lineup.entries) : emptyLineup()), [lineup]);
  const state = draft ?? saved;
  const dirty = draft !== null;

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const activeIds = useMemo(() => new Set(players.filter((p) => p.active).map((p) => p.id)), [players]);
  const nameOf = (id: string) => byId.get(id)?.name ?? "?";

  const issues = useMemo(() => validateLineup(state, {
    activeIds, names: new Map(players.map((p) => [p.id, p.name])), availability,
  }), [state, activeIds, players, availability]);

  const inLineup = new Set(playerIds(state));
  const pool = players.filter((p) => p.active && !inLineup.has(p.id))
    .sort((a, b) => RANK[availability.get(a.id) ?? "none"] - RANK[availability.get(b.id) ?? "none"] || a.name.localeCompare(b.name));

  function edit(fn: (s: LineupState) => LineupState) { setDraft(fn(state)); setMessage(""); setAuto(null); }

  /** Fill the empty spots from the players who can play, by position, form and answer. */
  function fillAuto() {
    const stats = seasonData?.stats ?? [];
    const r = autoFill(state, {
      players, availability, stats, matchesPlayed: Math.max(0, ...stats.map((s) => s.appearances)),
    });
    const names = (ids: string[]) => ids.slice(0, 3).map(nameOf).join(", ") + (ids.length > 3 ? "…" : "");
    const parts: string[] = [];
    if (r.filled === 0 && r.missing === 0) parts.push(t("l.autoFull"));
    else if (r.filled === 0) parts.push(t("l.autoNone"));
    else parts.push(t("l.autoDone", { n: r.filled }));
    if (r.outOfPosition.length) parts.push(t("l.autoOut", { names: r.outOfPosition.slice(0, 3).map((o) => `${nameOf(o.playerId)} (${o.slotLabel})`).join(", ") }));
    if (r.unsure.length) parts.push(t("l.autoUnsure", { names: names(r.unsure) }));
    if (r.missing > 0 && r.filled > 0) parts.push(t("l.autoMissing", { n: r.missing }));
    setAuto({ text: parts.join(" "), before: draft });
    setDraft(r.state);
    setSel(null);
    setMessage("");
  }

  // ── drag & drop ────────────────────────────────────────────────
  const pitchRef = useRef<HTMLDivElement>(null);
  const handleDrop = useCallback((item: DragItem, target: DropTarget | null, point: { x: number; y: number }) => {
    if (!target) return;
    const rect = pitchRef.current?.getBoundingClientRect();
    setDraft((prev) => {
      const s = prev ?? saved;
      switch (target.kind) {
        case "slot": return placePlayer(s, target.id, item.playerId);
        case "bench": return benchPlayer(s, item.playerId);
        case "pool": return removePlayer(s, item.playerId);
        case "pitch": {
          if (!rect) return s;
          const x = ((point.x - rect.left) / rect.width) * 100;
          const y = ((point.y - rect.top) / rect.height) * 100;
          return item.fromSlot ? movePlayer(s, item.fromSlot, x, y) : placeNearest(s, item.playerId, x, y);
        }
      }
    });
    setSel(null);
    setMessage("");
  }, [saved]);
  const { drag, begin, wasDrag } = useDrag(handleDrop);
  const dragging = drag?.item.playerId ?? null;

  // ── tap-to-assign (also the keyboard path) ─────────────────────
  function tapSlot(slotId: string) {
    if (wasDrag()) return;
    if (!editable) {
      setSel(sel?.kind === "slot" && sel.id === slotId ? null : { kind: "slot", id: slotId });
      return;
    }
    if (sel?.kind === "player") { edit((s) => placePlayer(s, slotId, sel.id)); setSel(null); return; }
    if (sel?.kind === "slot" && sel.id !== slotId && state.slots[sel.id]) {
      edit((s) => placePlayer(s, slotId, s.slots[sel.id])); setSel(null); return;
    }
    setSel(sel?.kind === "slot" && sel.id === slotId ? null : { kind: "slot", id: slotId });
  }

  function tapPlayer(id: string) {
    if (wasDrag()) return;
    if (!editable) {
      setSel(sel?.kind === "player" && sel.id === id ? null : { kind: "player", id });
      return;
    }
    if (sel?.kind === "slot") { edit((s) => placePlayer(s, sel.id, id)); setSel(null); return; }
    setSel(sel?.kind === "player" && sel.id === id ? null : { kind: "player", id });
  }

  // ── actions ────────────────────────────────────────────────────
  async function save() {
    if (!team) return;
    if (issues.errors.length) return setMessage(trDyn(`issue.${issues.errors[0].code}`, issues.errors[0].message).replace(/\{(\w+)\}/g, (_, k: string) => String(issues.errors[0].params?.[k] ?? "")));
    setSaving(true);
    try {
      await saveLineup(matchId, state.formation, toEntries(state));
      await mutate();
      setDraft(null);
      setMessage(t("l.savedMsg"));
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
      setMessage(t("l.copiedFrom", { opponent: src.opponent }));
    } catch (e) { setMessage(friendlyError(e)); }
  }

  async function image(share: boolean) {
    try {
      const blob = await lineupImageBlob({
        title: `${teamName} ${t("img.vs")} ${match.opponent}`,
        subtitle: [shortDate(match.kickoff), match.venue].filter(Boolean).join(" · "),
        formation: state.formation,
        starters: startersOf(state).map(({ slot, playerId }) => ({ ...positionOf(state, slot), number: byId.get(playerId)?.number ?? null, name: nameOf(playerId) })),
        bench: state.bench.map((id) => ({ number: byId.get(id)?.number ?? null, name: nameOf(id) })),
        benchTitle: t("img.bench"),
        footer: t("img.footer"),
      });
      const file = new File([blob], imageFileName(teamName, match.opponent), { type: "image/png" });
      if (share && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: `${teamName} ${t("img.vs")} ${match.opponent}` }); return; }
        catch (e) { if ((e as Error).name === "AbortError") return; }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMessage(t("l.imageSaved"));
    } catch { setMessage(t("l.imageFail")); }
  }

  if (loading) return <p className="text-sm text-pitch-400">{t("l.loading")}</p>;

  const selectedStarter = sel?.kind === "slot" ? state.slots[sel.id] : undefined;
  const selectedBench = sel?.kind === "player" && state.bench.includes(sel.id) ? sel.id : undefined;
  const selectedPlayer = sel?.kind === "player" ? sel.id : undefined;
  const placed = startersOf(state);
  const overSlot = drag?.over?.kind === "slot" ? drag.over.id : null;

  return (
    <section className="space-y-4" aria-label={t("tab.lineup")}>
      <div className="flex flex-wrap items-center gap-2">
        <select className="input-field !w-auto !py-2" aria-label={t("l.formation")} disabled={!editable} value={state.formation}
          onChange={(e) => edit((s) => changeFormation(s, e.target.value))}>
          {!PRESET_FORMATIONS.includes(state.formation as never) && <option value={state.formation}>{state.formation}</option>}
          {PRESET_FORMATIONS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        {editable && (
          <>
            <input className="input-field !w-24 !py-2" placeholder="4-1-4-1" aria-label={t("l.custom")} value={customFormation}
              onChange={(e) => setCustomFormation(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && parseFormation(customFormation) && getFormation(customFormation)) { edit((s) => changeFormation(s, customFormation)); setCustomFormation(""); } }} />
            <button className="btn-primary flex items-center gap-1.5 !py-2" onClick={fillAuto}><Sparkles className="w-4 h-4" />{t("l.auto")}</button>
            <button className="btn-ghost flex items-center gap-1.5" onClick={openSources}><Copy className="w-4 h-4" />{t("l.copyPrev")}</button>
            <button className="btn-ghost" onClick={() => edit(resetPositions)}>{t("l.resetSpots")}</button>
            <button className="btn-ghost flex items-center gap-1.5" onClick={() => { edit(resetLineup); setSel(null); }}><RotateCcw className="w-4 h-4" />{t("l.clear")}</button>
          </>
        )}
        <span className="flex gap-1 ml-auto">
          <button className="btn-ghost flex items-center gap-1.5" onClick={() => image(false)} disabled={placed.length === 0}><Download className="w-4 h-4" />{t("l.image")}</button>
          {shareable && <button className="btn-ghost flex items-center gap-1.5" onClick={() => image(true)} disabled={placed.length === 0} aria-label={t("l.imageShare")}><Share2 className="w-4 h-4" /></button>}
        </span>
      </div>

      {auto && (
        <div role="status" className="surface-2 px-3 py-2.5 text-xs text-pitch-200 flex items-start gap-3">
          <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-amber-300" />
          <span className="flex-1">{auto.text}</span>
          <button className="flex items-center gap-1 underline text-pitch-300 shrink-0" onClick={() => { setDraft(auto.before); setAuto(null); }}>
            <Undo2 className="w-3.5 h-3.5" />{t("l.undo")}
          </button>
        </div>
      )}

      {/* Phone: pitch on top, tray (bench + squad) pinned below it. Desktop: bench and squad on the left, pitch on the right. */}
      <div className="md:grid md:grid-cols-[17rem_minmax(0,1fr)] md:gap-6 md:items-start space-y-4 md:space-y-0">
      <div className="md:col-start-2 md:row-start-1 space-y-4 min-w-0">
      <div data-drop="pitch" className={cn("rounded-xl", drag && "ring-2 ring-white/20")}>
        <Pitch ref={pitchRef}>
          {getFormation(state.formation)?.slots.map((slot) => {
            const pid = state.slots[slot.id];
            const pos = positionOf(state, slot);
            const selected = sel?.kind === "slot" && sel.id === slot.id;
            const a = pid ? availability.get(pid) ?? "none" : null;
            const isOver = overSlot === slot.id;
            const ghosted = pid && pid === dragging;
            return (
              <button key={slot.id} type="button" disabled={!editable && !pid}
                aria-label={pid ? `${slot.label}: ${nameOf(pid)}` : t("l.emptySlot", { label: slot.label })}
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, WebkitTouchCallout: "none" }}
                className={cn("absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 w-16 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-lg",
                  (selected || isOver) && "z-10", ghosted && "opacity-30")}
                onPointerDown={(e) => { if (editable && pid) begin(e, { playerId: pid, fromSlot: slot.id }, shortName(nameOf(pid))); }}
                onContextMenu={(e) => e.preventDefault()}
                onClick={() => tapSlot(slot.id)}>
                <span data-drop={`slot:${slot.id}`}
                  className={cn("relative w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shadow-lg border-2 transition-transform",
                    pid ? "bg-white text-black border-white cursor-grab" : "bg-black/30 text-white/80 border-dashed border-white/60",
                    selected && "ring-4 ring-amber-400 scale-110", isOver && "ring-4 ring-white scale-125")}>
                  {pid ? (byId.get(pid)?.number ?? "•") : slot.label}
                  {a && <span className={cn("absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border border-black", DOT[a])} />}
                </span>
                {pid && <span title={nameOf(pid)} className="text-[11px] leading-tight font-medium text-white bg-black/50 rounded px-1 max-w-full truncate">{shortName(nameOf(pid))}</span>}
              </button>
            );
          })}
        </Pitch>
      </div>

      {editable && (selectedStarter || selectedBench) && (
        <div className="surface-2 p-3 flex items-center gap-2 flex-wrap">
          <span className="text-sm flex-1 min-w-0 truncate">{nameOf((selectedStarter ?? selectedBench)!)}</span>
          {selectedStarter && (
            <button className="btn-ghost flex items-center gap-1.5" onClick={() => { edit((s) => benchPlayer(s, selectedStarter)); setSel(null); }}>
              <ArrowDownToLine className="w-4 h-4" />{t("l.toBench")}
            </button>
          )}
          <button className="btn-ghost flex items-center gap-1.5 text-red-400" onClick={() => { edit((s) => removePlayer(s, (selectedStarter ?? selectedBench)!)); setSel(null); }}>
            <UserMinus className="w-4 h-4" />{t("l.remove")}
          </button>
          {selectedStarter && <span className="text-xs text-pitch-500 w-full">{t("l.hintSlot")}</span>}
        </div>
      )}
      {!editable && (selectedStarter || selectedPlayer) && (
        <div className="surface-2 p-3 text-sm" role="status">
          {nameOf((selectedStarter ?? selectedPlayer)!)}
        </div>
      )}
      {editable && !selectedStarter && !selectedBench && (
        <p className="text-xs text-pitch-500">{sel?.kind === "player" ? t("l.placeFor", { name: nameOf(sel.id) }) : t("l.hintDrag")}</p>
      )}

      {(issues.errors.length > 0 || issues.warnings.length > 0) && (
        <ul className="space-y-1" aria-label={t("l.warnings")}>
          {[...issues.errors, ...issues.warnings].slice(0, 6).map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-amber-400"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{trDyn(`issue.${w.code}`, w.message).replace(/\{(\w+)\}/g, (_, k: string) => String(w.params?.[k] ?? ""))}</li>
          ))}
        </ul>
      )}

      </div>

      {/* Tray: pinned under the pitch on phones so players can be dragged without scrolling; a left column on desktop */}
      <div className="sticky bottom-[calc(3.9rem+env(safe-area-inset-bottom))] z-30 -mx-4 px-4 pt-2 pb-2 bg-pitch-950/95 backdrop-blur border-t border-white/10 space-y-1
        md:col-start-1 md:row-start-1 md:top-4 md:bottom-auto md:mx-0 md:px-0 md:pt-0 md:pb-0 md:border-0 md:bg-transparent md:backdrop-blur-none md:max-h-[calc(100dvh-2rem)] md:overflow-y-auto md:space-y-3">
        {editable && (
          <div className="flex items-center gap-2 min-h-11">
            <button className="btn-primary flex items-center gap-2 py-2.5 px-4 whitespace-nowrap disabled:opacity-50" disabled={!dirty || saving} onClick={save}>
              <Save className="w-4 h-4" />{saving ? t("c.saving") : dirty ? t("l.save") : t("l.saved")}
            </button>
            {dirty && <button className="btn-ghost whitespace-nowrap" onClick={() => { setDraft(null); setSel(null); }}>{t("l.discard")}</button>}
            <span role="status" className="text-xs text-green-400 truncate">{message}</span>
            <button type="button" aria-expanded={trayOpen} aria-label={t("l.trayToggle")} onClick={() => setTrayOpen((o) => !o)}
              className="md:hidden ml-auto shrink-0 flex items-center gap-1.5 px-3 h-10 rounded-lg border border-white/10 text-xs text-pitch-300">
              {!trayOpen && <span>{t("l.bench", { n: state.bench.length })} · {t("l.squad", { n: pool.length })}</span>}
              <ChevronDown className={cn("w-4 h-4 transition-transform", trayOpen && "rotate-180")} />
            </button>
          </div>
        )}
      <div className={cn(!trayOpen && "max-md:hidden", "space-y-1")}>
      {/* Bench (drop zone) */}
      <div data-drop="bench" className={cn("rounded-xl px-2 py-1.5 transition-colors", drag?.over?.kind === "bench" && "bg-white/10 ring-2 ring-white/40")}>
        <h3 className="text-xs uppercase tracking-widest text-pitch-500 mb-1">{t("l.bench", { n: state.bench.length })}</h3>
        <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 min-h-11 max-h-24 overflow-y-auto md:max-h-none md:overflow-visible pb-1">
          {state.bench.length === 0 && <span className="text-xs text-pitch-500 self-center">{editable ? t("l.benchEmpty") : "—"}</span>}
          {state.bench.map((id) => (
            <Chip key={id} player={byId.get(id)} a={availability.get(id) ?? "none"} selected={sel?.kind === "player" && sel.id === id}
              ghosted={dragging === id} onClick={() => tapPlayer(id)}
              onPress={editable ? (e) => begin(e, { playerId: id, fromSlot: null }, shortName(nameOf(id))) : undefined} />
          ))}
        </div>
      </div>

        {/* Remaining squad (drop zone: dropping here takes a player out of the lineup) */}
      <div data-drop="pool" className={cn("rounded-xl px-2 py-1.5 transition-colors", drag?.over?.kind === "pool" && "bg-white/10 ring-2 ring-white/40")}>
        <h3 className="text-xs uppercase tracking-widest text-pitch-500 mb-1">{t("l.squad", { n: pool.length })}</h3>
        <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 min-h-11 max-h-32 overflow-y-auto overscroll-contain md:max-h-none md:overflow-visible pb-1">
          {pool.map((p) => (
            <Chip key={p.id} player={p} a={availability.get(p.id) ?? "none"} selected={sel?.kind === "player" && sel.id === p.id}
              ghosted={dragging === p.id} onClick={() => tapPlayer(p.id)}
              onPress={editable ? (e) => begin(e, { playerId: p.id, fromSlot: null }, shortName(p.name)) : undefined}
              onBench={editable ? () => edit((s) => benchPlayer(s, p.id)) : undefined} benchLabel={t("l.benchAria", { name: p.name })} />
          ))}
          {pool.length === 0 && <span className="text-xs text-pitch-500 self-center">{t("l.everyoneIn")}</span>}
        </div>
      </div>
      </div>

        {!editable && (
          <>
            <span role="status" className="text-xs text-green-400">{message}</span>
            {placed.length === 0 && <p className="text-sm text-pitch-400">{t("l.none")}</p>}
          </>
        )}
      </div>
      </div>
      {sources && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70" onClick={() => setSources(null)}>
          <div className="bg-pitch-900 border border-pitch-700 rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">{t("l.copyFrom")}</h3>
            {sources.length === 0 && <p className="text-sm text-pitch-400">{t("l.noSaved")}</p>}
            {sources.map((s) => (
              <button key={s.matchId} className="w-full surface-2 p-3 text-left text-sm" onClick={() => duplicate(s)}>
                {t("m.vs")} {s.opponent} <span className="text-pitch-500">· {formatNumericDate(s.kickoff)} · {s.formation}</span>
              </button>
            ))}
            <button className="btn-ghost w-full" onClick={() => setSources(null)}>{t("c.cancel")}</button>
          </div>
        </div>
      )}

      {/* The player being dragged */}
      {drag && (
        <div className="fixed z-[70] pointer-events-none -translate-x-1/2 -translate-y-[130%] flex flex-col items-center gap-0.5"
          style={{ left: drag.x, top: drag.y }} aria-hidden>
          <span className="w-12 h-12 rounded-full bg-white text-black font-bold flex items-center justify-center shadow-2xl ring-4 ring-amber-400 scale-110">
            {byId.get(drag.item.playerId)?.number ?? "•"}
          </span>
          <span className="text-xs font-medium bg-black/80 text-white rounded px-1.5 py-0.5">{drag.label}</span>
        </div>
      )}
    </section>
  );
}

function Chip({ player, a, selected, ghosted, onClick, onPress, onBench, benchLabel }: {
  player: Player | undefined; a: AvailabilityState; selected: boolean; ghosted?: boolean; onClick: () => void;
  onPress?: (e: React.PointerEvent) => void; onBench?: () => void; benchLabel?: string;
}) {
  if (!player) return null;
  return (
    <span className={cn("inline-flex min-w-0 max-md:w-full md:shrink-0 items-stretch rounded-lg border text-sm overflow-hidden select-none transition-opacity",
      selected ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-white/5", ghosted && "opacity-30")}>
      <button type="button" onClick={onClick} onPointerDown={onPress} onContextMenu={(e) => e.preventDefault()} aria-pressed={selected}
        style={{ WebkitTouchCallout: "none" }}
        className={cn("flex min-w-0 flex-1 items-center gap-2 pl-2.5 pr-2.5 py-2.5 text-left", onPress && "cursor-grab")}>
        <span className={cn("w-2 h-2 rounded-full", DOT[a])} aria-hidden />
        {player.number != null && <span className="text-pitch-500 tabular-nums text-xs">{player.number}</span>}
        <span title={player.name} className="truncate">{shortName(player.name)}</span>
      </button>
      {onBench && <button type="button" aria-label={benchLabel} onClick={onBench} className="px-2.5 border-l border-white/10 text-pitch-500 hover:text-white"><ArrowDownToLine className="w-3.5 h-3.5" /></button>}
    </span>
  );
}
