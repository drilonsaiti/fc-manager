"use client";
import { useEffect, useMemo, useState } from "react";
import { Flag, Play, RotateCcw, Square, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEvents, useLineup } from "@/hooks/data";
import { addEvent, deleteEvent, finishMatch, reopenMatch } from "@/lib/db/events";
import { startMatch } from "@/lib/db/matches";
import { friendlyError } from "@/lib/db/util";
import { buildPlayerStats, clockMinute, computeScore, eventProblem, onPitch, playedSoFar, sortEvents } from "@/features/matchday/stats";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils/cn";
import type { EventType, Match, MatchEvent, Player, Side } from "@/types";

type Draft = { type: EventType; side: Side } | null;

const ICON: Record<EventType, string> = { goal: "⚽", own_goal: "⚽", yellow: "🟨", red: "🟥", sub: "🔁" };

export function describeEvent(e: MatchEvent, name: (id: string | null) => string, opponent: string): string {
  switch (e.type) {
    case "goal": return e.side === "us" ? `Goal — ${e.playerId ? name(e.playerId) : "scorer not set"}${e.relatedPlayerId ? ` (assist ${name(e.relatedPlayerId)})` : ""}` : `Goal — ${opponent}`;
    case "own_goal": return e.side === "us" ? `Own goal — ${name(e.playerId)}` : `Own goal — ${opponent}`;
    case "yellow": return `Yellow card — ${e.side === "us" ? name(e.playerId) : opponent}`;
    case "red": return `Red card — ${e.side === "us" ? name(e.playerId) : opponent}`;
    case "sub": return `Sub — ${name(e.relatedPlayerId)} on for ${name(e.playerId)}`;
  }
}

export function MatchdayPanel({ match, players, onMatchChange }: { match: Match; players: Player[]; onMatchChange: () => void }) {
  const { team, canManage } = useAuth();
  const { events, mutate } = useEvents(match.id);
  const { lineup } = useLineup(match.id);
  const [now, setNow] = useState(() => new Date());
  const [draft, setDraft] = useState<Draft>(null);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");

  const live = match.status === "live";
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, [live]);

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const name = (id: string | null) => (id ? byId.get(id)?.name ?? "Unknown" : "—");
  const starters = useMemo(() => (lineup?.entries ?? []).filter((e) => e.role === "starter").map((e) => e.playerId), [lineup]);
  const hasLineup = starters.length > 0;
  const sorted = useMemo(() => sortEvents(events), [events]);
  const score = computeScore(sorted);
  const minute = clockMinute(match.startedAt, now, match.durationMinutes);

  async function run(fn: () => Promise<void>) {
    setError("");
    try { await fn(); } catch (e) { setError(friendlyError(e)); }
  }

  async function add(type: EventType, side: Side, minuteValue: number, playerId: string | null, related: string | null) {
    if (!team) return;
    await addEvent(match.id, team.id, { type, side, minute: minuteValue, playerId, relatedPlayerId: related });
    await mutate();
  }

  // ── Not started ────────────────────────────────────────────────
  if (match.status === "scheduled" || match.status === "cancelled") {
    return (
      <div className="surface p-6 text-center space-y-3">
        <p className="text-pitch-300 text-sm">{match.status === "cancelled" ? "This match is cancelled." : hasLineup ? "Lineup is ready." : "No lineup saved yet — you can still record the score and goals."}</p>
        {canManage && match.status === "scheduled" && (
          <button className="btn-primary inline-flex items-center gap-2 py-3 px-6 text-base" onClick={() => run(async () => { await startMatch(match.id); onMatchChange(); })}>
            <Play className="w-5 h-5" />Kick off
          </button>
        )}
        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
      </div>
    );
  }

  const final = match.status === "final";

  return (
    <section className="space-y-4" aria-label="Matchday">
      <div className="surface p-5 text-center">
        <p className="text-xs uppercase tracking-widest text-pitch-500">{final ? "Full time" : `${minute}'`}</p>
        <p className="font-display text-6xl tracking-wide tabular-nums mt-1">
          {final ? `${match.ourScore} – ${match.theirScore}` : `${score.us} – ${score.them}`}
        </p>
        <p className="text-sm text-pitch-400 mt-1">{match.isHome ? "Us" : match.opponent} v {match.isHome ? match.opponent : "Us"}</p>
      </div>

      {canManage && live && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Big tone="bg-green-500 text-black" onClick={() => setDraft({ type: "goal", side: "us" })}>⚽ Our goal</Big>
            <Big tone="bg-red-500/90 text-white" onClick={() => run(() => add("goal", "them", minute, null, null))}>⚽ {match.opponent} goal</Big>
            <Big onClick={() => setDraft({ type: "yellow", side: "us" })}>🟨 Yellow</Big>
            <Big onClick={() => setDraft({ type: "red", side: "us" })}>🟥 Red</Big>
            <Big onClick={() => setDraft({ type: "sub", side: "us" })}>🔁 Substitution</Big>
            <Big onClick={() => setDraft({ type: "own_goal", side: "us" })}>Own goal</Big>
          </div>
          <button className="btn-primary w-full flex items-center justify-center gap-2 py-3" onClick={() => setFinishing(true)}>
            <Flag className="w-4 h-4" />Full time
          </button>
        </>
      )}
      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}

      <div>
        <h3 className="text-xs uppercase tracking-widest text-pitch-500 mb-2">Timeline</h3>
        {sorted.length === 0 ? <p className="text-sm text-pitch-500">Nothing recorded yet.</p> : (
          <ul className="surface divide-y divide-white/5">
            {sorted.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-9 text-pitch-500 tabular-nums">{e.minute}&apos;</span>
                <span aria-hidden>{ICON[e.type]}</span>
                <span className="flex-1 min-w-0 truncate">{describeEvent(e, name, match.opponent)}</span>
                {canManage && !final && (
                  <button aria-label="Undo this event" className="p-1.5 text-pitch-500 hover:text-red-400"
                    onClick={() => run(async () => { await deleteEvent(e.id); await mutate(); })}><Trash2 className="w-4 h-4" /></button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canManage && final && (
        <button className="btn-ghost flex items-center gap-2" onClick={() => run(async () => {
          if (!confirm("Reopen this match to correct it? Player stats are rebuilt when you finish again.")) return;
          await reopenMatch(match.id); onMatchChange();
        })}><RotateCcw className="w-4 h-4" />Reopen to correct</button>
      )}

      {draft && (
        <EventSheet key={draft.type} draft={draft} defaultMinute={minute} duration={match.durationMinutes} players={players} starters={starters}
          events={sorted} hasLineup={hasLineup} onClose={() => setDraft(null)}
          onSave={async (m, p, r) => { await add(draft.type, draft.side, m, p, r); setDraft(null); }} />
      )}

      <Modal open={finishing} onClose={() => setFinishing(false)} title="Full time" size="sm">
        <FinishForm ours={score.us} theirs={score.them} onCancel={() => setFinishing(false)} onConfirm={async (o, t) => {
          await finishMatch(match.id, o, t, buildPlayerStats({ starters, events: sorted, durationMinutes: match.durationMinutes }));
          setFinishing(false); onMatchChange();
        }} />
      </Modal>
    </section>
  );
}

function Big({ children, onClick, tone = "surface-2" }: { children: React.ReactNode; onClick: () => void; tone?: string }) {
  return (
    <button onClick={onClick} className={cn("rounded-xl py-5 text-base font-semibold active:scale-[0.97] transition-transform", tone)}>{children}</button>
  );
}

function FinishForm({ ours, theirs, onConfirm, onCancel }: { ours: number; theirs: number; onConfirm: (o: number, t: number) => Promise<void>; onCancel: () => void }) {
  const [o, setO] = useState(String(ours));
  const [t, setT] = useState(String(theirs));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const valid = (v: string) => /^\d{1,2}$/.test(v);
  return (
    <div className="space-y-4">
      <p className="text-sm text-pitch-300">Check the final score. Player stats are saved from the events you recorded.</p>
      <div className="flex items-center justify-center gap-3">
        <input aria-label="Our goals" className="input-field !w-20 text-center text-2xl" inputMode="numeric" value={o} onChange={(e) => setO(e.target.value)} />
        <span>–</span>
        <input aria-label="Their goals" className="input-field !w-20 text-center text-2xl" inputMode="numeric" value={t} onChange={(e) => setT(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={onCancel}>Back</button>
        <button className="btn-primary flex items-center gap-2 disabled:opacity-60" disabled={busy || !valid(o) || !valid(t)}
          onClick={async () => { setBusy(true); try { await onConfirm(Number(o), Number(t)); } catch (e) { setError(friendlyError(e)); setBusy(false); } }}>
          <Square className="w-4 h-4" />Finish match
        </button>
      </div>
    </div>
  );
}

function EventSheet({ draft, defaultMinute, duration, players, starters, events, hasLineup, onClose, onSave }: {
  draft: NonNullable<Draft>; defaultMinute: number; duration: number; players: Player[]; starters: string[];
  events: MatchEvent[]; hasLineup: boolean; onClose: () => void;
  onSave: (minute: number, playerId: string | null, related: string | null) => Promise<void>;
}) {
  const [minute, setMinute] = useState(String(defaultMinute));
  const [primary, setPrimary] = useState<string | null>(null);
  const [related, setRelated] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const active = players.filter((p) => p.active);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "Unknown";
  const m = Math.max(0, Math.min(Number(minute) || 0, duration + 20));
  const pitch = new Set(hasLineup ? onPitch(starters, events, m) : active.map((p) => p.id));
  const played = playedSoFar(starters, events);

  const isSub = draft.type === "sub";
  const primaryList = active.filter((p) => pitch.has(p.id));
  const relatedList = isSub ? active.filter((p) => !pitch.has(p.id) && !(hasLineup && played.has(p.id))) : primaryList.filter((p) => p.id !== primary);
  const titles: Record<EventType, [string, string | null]> = {
    goal: ["Who scored?", "Assist (optional)"], own_goal: ["Who put it in their own net?", null],
    yellow: ["Who got the card?", null], red: ["Who got the card?", null], sub: ["Who goes off?", "Who comes on?"],
  };
  const [t1, t2] = titles[draft.type];
  const needsPlayer = draft.type !== "goal";

  async function save() {
    setError("");
    if (needsPlayer && !primary) return setError("Pick a player.");
    if (isSub && !related) return setError("Pick who comes on.");
    if (hasLineup) {
      const problem = eventProblem(starters, events.filter((e) => e.minute <= m), { type: draft.type, side: draft.side, playerId: primary, relatedPlayerId: related }, nameOf);
      if (problem) return setError(problem);
    }
    setBusy(true);
    try { await onSave(m, primary, related); } catch (e) { setError(friendlyError(e)); setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={`${ICON[draft.type]} ${draft.type === "goal" ? "Goal" : draft.type === "own_goal" ? "Own goal" : draft.type === "sub" ? "Substitution" : draft.type === "yellow" ? "Yellow card" : "Red card"}`}>
      <div className="space-y-4">
        <label className="flex items-center gap-3 text-sm">Minute
          <input className="input-field !w-20 text-center" inputMode="numeric" value={minute} onChange={(e) => setMinute(e.target.value)} />
        </label>
        <PickList title={t1} players={primaryList} value={primary} onChange={(id) => { setPrimary(id); if (id === related) setRelated(null); }} allowNone={draft.type === "goal"} noneLabel="Not sure / skip" />
        {t2 && <PickList title={t2} players={relatedList} value={related} onChange={setRelated} allowNone={!isSub} noneLabel="No assist" />}
        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary disabled:opacity-60" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </Modal>
  );
}

function PickList({ title, players, value, onChange, allowNone, noneLabel }: {
  title: string; players: Player[]; value: string | null; onChange: (id: string | null) => void; allowNone: boolean; noneLabel: string;
}) {
  return (
    <fieldset>
      <legend className="text-xs text-pitch-400 mb-2">{title}</legend>
      <div className="flex flex-wrap gap-2">
        {allowNone && (
          <button type="button" aria-pressed={value === null} onClick={() => onChange(null)}
            className={cn("px-3 py-2 rounded-lg border text-sm", value === null ? "bg-white text-black border-white" : "border-white/10 text-pitch-400")}>{noneLabel}</button>
        )}
        {players.map((p) => (
          <button type="button" key={p.id} aria-pressed={value === p.id} onClick={() => onChange(p.id)}
            className={cn("px-3 py-2 rounded-lg border text-sm", value === p.id ? "bg-white text-black border-white" : "border-white/10")}>
            {p.number != null && <span className="text-pitch-500 mr-1.5 tabular-nums">{p.number}</span>}{p.name}
          </button>
        ))}
        {players.length === 0 && <span className="text-xs text-pitch-500">No one available for this.</span>}
      </div>
    </fieldset>
  );
}
