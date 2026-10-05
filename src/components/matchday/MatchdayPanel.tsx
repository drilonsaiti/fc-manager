"use client";
import { useEffect, useMemo, useState } from "react";
import { Flag, Play, RotateCcw, Square, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEvents, useLineup } from "@/hooks/data";
import { addEvent, deleteEvent, finishMatch, reopenMatch } from "@/lib/db/events";
import { startMatch } from "@/lib/db/matches";
import { friendlyError } from "@/lib/db/util";
import { buildPlayerStats, clockMinute, computeScore, eventIssue, onPitch, playedSoFar, sortEvents } from "@/features/matchday/stats";
import { useT, type MessageKey, type Params } from "@/i18n";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils/cn";
import type { EventType, Match, MatchEvent, Player, Side } from "@/types";

type Draft = { type: EventType; side: Side } | null;

const ICON: Record<EventType, string> = { goal: "⚽", own_goal: "⚽", yellow: "🟨", red: "🟥", sub: "🔁" };

type T = (key: MessageKey, params?: Params) => string;

export function describeEvent(e: MatchEvent, name: (id: string | null) => string, opponent: string, t: T): string {
  switch (e.type) {
    case "goal":
      if (e.side !== "us") return t("ev.goalThem", { opponent });
      if (!e.playerId) return t("ev.goalNoScorer");
      return e.relatedPlayerId ? t("ev.goalUsAssist", { name: name(e.playerId), assist: name(e.relatedPlayerId) }) : t("ev.goalUs", { name: name(e.playerId) });
    case "own_goal": return e.side === "us" ? t("ev.ownGoalUs", { name: name(e.playerId) }) : t("ev.ownGoalThem", { opponent });
    case "yellow": return t("ev.yellowCard", { name: e.side === "us" ? name(e.playerId) : opponent });
    case "red": return t("ev.redCard", { name: e.side === "us" ? name(e.playerId) : opponent });
    case "sub": return t("ev.subLine", { on: name(e.relatedPlayerId), off: name(e.playerId) });
  }
}

export function MatchdayPanel({ match, players, onMatchChange }: { match: Match; players: Player[]; onMatchChange: () => void }) {
  const { t } = useT();
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
        <p className="text-pitch-300 text-sm">{match.status === "cancelled" ? t("md.cancelled") : hasLineup ? t("md.lineupReady") : t("md.noLineup")}</p>
        {canManage && match.status === "scheduled" && (
          <button className="btn-primary inline-flex items-center gap-2 py-3 px-6 text-base" onClick={() => run(async () => { await startMatch(match.id); onMatchChange(); })}>
            <Play className="w-5 h-5" />{t("md.kickoff")}
          </button>
        )}
        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
      </div>
    );
  }

  const final = match.status === "final";

  return (
    <section className="space-y-4" aria-label={t("tab.matchday")}>
      <div className="surface p-5 text-center">
        <p className="text-xs uppercase tracking-widest text-pitch-500">{final ? t("md.fullTime") : `${minute}'`}</p>
        <p className="font-display text-6xl tracking-wide tabular-nums mt-1">
          {final ? `${match.ourScore} – ${match.theirScore}` : `${score.us} – ${score.them}`}
        </p>
        <p className="text-sm text-pitch-400 mt-1">{match.isHome ? t("md.us") : match.opponent} – {match.isHome ? match.opponent : t("md.us")}</p>
      </div>

      {canManage && live && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Big tone="bg-green-500 text-black" onClick={() => setDraft({ type: "goal", side: "us" })}>{t("md.ourGoal")}</Big>
            <Big tone="bg-red-500/90 text-white" onClick={() => run(() => add("goal", "them", minute, null, null))}>{t("md.theirGoal", { opponent: match.opponent })}</Big>
            <Big onClick={() => setDraft({ type: "yellow", side: "us" })}>{t("md.yellow")}</Big>
            <Big onClick={() => setDraft({ type: "red", side: "us" })}>{t("md.red")}</Big>
            <Big onClick={() => setDraft({ type: "sub", side: "us" })}>{t("md.sub")}</Big>
            <Big onClick={() => setDraft({ type: "own_goal", side: "us" })}>{t("md.ownGoal")}</Big>
          </div>
          <button className="btn-primary w-full flex items-center justify-center gap-2 py-3" onClick={() => setFinishing(true)}>
            <Flag className="w-4 h-4" />{t("md.fullTime")}
          </button>
        </>
      )}
      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}

      <div>
        <h3 className="text-xs uppercase tracking-widest text-pitch-500 mb-2">{t("md.timeline")}</h3>
        {sorted.length === 0 ? <p className="text-sm text-pitch-500">{t("md.nothing")}</p> : (
          <ul className="surface divide-y divide-white/5">
            {sorted.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-9 text-pitch-500 tabular-nums">{e.minute}&apos;</span>
                <span aria-hidden>{ICON[e.type]}</span>
                <span className="flex-1 min-w-0 truncate">{describeEvent(e, name, match.opponent, t)}</span>
                {canManage && !final && (
                  <button aria-label={t("md.undo")} className="p-1.5 text-pitch-500 hover:text-red-400"
                    onClick={() => run(async () => { await deleteEvent(e.id); await mutate(); })}><Trash2 className="w-4 h-4" /></button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canManage && final && (
        <button className="btn-ghost flex items-center gap-2" onClick={() => run(async () => {
          if (!confirm(t("md.confirmReopen"))) return;
          await reopenMatch(match.id); onMatchChange();
        })}><RotateCcw className="w-4 h-4" />{t("md.reopen")}</button>
      )}

      {draft && (
        <EventSheet key={draft.type} draft={draft} defaultMinute={minute} duration={match.durationMinutes} players={players} starters={starters}
          events={sorted} hasLineup={hasLineup} onClose={() => setDraft(null)}
          onSave={async (m, p, r) => { await add(draft.type, draft.side, m, p, r); setDraft(null); }} />
      )}

      <Modal open={finishing} onClose={() => setFinishing(false)} title={t("md.fullTime")} size="sm">
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

function FinishForm({ ours, theirs, onConfirm, onCancel }: { ours: number; theirs: number; onConfirm: (o: number, th: number) => Promise<void>; onCancel: () => void }) {
  const { t } = useT();
  const [o, setO] = useState(String(ours));
  const [th, setTh] = useState(String(theirs));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const valid = (v: string) => /^\d{1,2}$/.test(v);
  return (
    <div className="space-y-4">
      <p className="text-sm text-pitch-300">{t("md.finishHelp")}</p>
      <div className="flex items-center justify-center gap-3">
        <input aria-label={t("md.ourGoals")} className="input-field !w-20 text-center text-2xl" inputMode="numeric" value={o} onChange={(e) => setO(e.target.value)} />
        <span>–</span>
        <input aria-label={t("md.theirGoals")} className="input-field !w-20 text-center text-2xl" inputMode="numeric" value={th} onChange={(e) => setTh(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={onCancel}>{t("md.back")}</button>
        <button className="btn-primary flex items-center gap-2 disabled:opacity-60" disabled={busy || !valid(o) || !valid(th)}
          onClick={async () => { setBusy(true); try { await onConfirm(Number(o), Number(th)); } catch (e) { setError(friendlyError(e)); setBusy(false); } }}>
          <Square className="w-4 h-4" />{t("md.finish")}
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
  const { t } = useT();
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
  const titles: Record<EventType, [MessageKey, MessageKey | null]> = {
    goal: ["md.whoScored", "md.assist"], own_goal: ["md.whoOwn", null],
    yellow: ["md.whoCard", null], red: ["md.whoCard", null], sub: ["md.whoOff", "md.whoOn"],
  };
  const [t1, t2] = titles[draft.type];
  const eventTitle: Record<EventType, MessageKey> = { goal: "ev.goal", own_goal: "ev.ownGoal", sub: "ev.sub", yellow: "ev.yellow", red: "ev.red" };
  const needsPlayer = draft.type !== "goal";

  async function save() {
    setError("");
    if (needsPlayer && !primary) return setError(t("prob.pick"));
    if (isSub && !related) return setError(t("prob.pickOn"));
    if (hasLineup) {
      const issue = eventIssue(starters, events.filter((e) => e.minute <= m), { type: draft.type, side: draft.side, playerId: primary, relatedPlayerId: related }, nameOf);
      if (issue) return setError(t(`prob.${issue.code}` as MessageKey, { name: issue.name ?? "" }));
    }
    setBusy(true);
    try { await onSave(m, primary, related); } catch (e) { setError(friendlyError(e)); setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={`${ICON[draft.type]} ${t(eventTitle[draft.type])}`}>
      <div className="space-y-4">
        <label className="flex items-center gap-3 text-sm">{t("md.minute")}
          <input className="input-field !w-20 text-center" inputMode="numeric" value={minute} onChange={(e) => setMinute(e.target.value)} />
        </label>
        <PickList title={t(t1)} players={primaryList} value={primary} onChange={(id) => { setPrimary(id); if (id === related) setRelated(null); }} allowNone={draft.type === "goal"} noneLabel={t("md.skip")} empty={t("md.nobody")} />
        {t2 && <PickList title={t(t2)} players={relatedList} value={related} onChange={setRelated} allowNone={!isSub} noneLabel={t("md.noAssist")} empty={t("md.nobody")} />}
        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>{t("c.cancel")}</button>
          <button className="btn-primary disabled:opacity-60" disabled={busy} onClick={save}>{busy ? t("c.saving") : t("c.save")}</button>
        </div>
      </div>
    </Modal>
  );
}

function PickList({ title, players, value, onChange, allowNone, noneLabel, empty }: {
  title: string; players: Player[]; value: string | null; onChange: (id: string | null) => void; allowNone: boolean; noneLabel: string; empty: string;
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
        {players.length === 0 && <span className="text-xs text-pitch-500">{empty}</span>}
      </div>
    </fieldset>
  );
}
