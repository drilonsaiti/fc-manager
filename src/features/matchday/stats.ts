import type { MatchEvent, PlayerMatchStat } from "@/types";

type Ev = Pick<MatchEvent, "type" | "side" | "minute" | "playerId" | "relatedPlayerId"> & { createdAt?: Date | number };

/** Chronological order; ties (same minute) keep the order the coach recorded them. */
export function sortEvents<T extends Ev>(events: T[]): T[] {
  return events
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.minute - b.e.minute
      || (+(a.e.createdAt ?? 0) - +(b.e.createdAt ?? 0))
      || a.i - b.i)
    .map((x) => x.e);
}

/** Own goals count for the other side. */
export function computeScore(events: Ev[]): { us: number; them: number } {
  let us = 0, them = 0;
  for (const e of events) {
    if (e.type === "goal") { if (e.side === "us") us++; else them++; }
    if (e.type === "own_goal") { if (e.side === "us") them++; else us++; }
  }
  return { us, them };
}

/** A second yellow card sends a player off, exactly like a red. */
function sendingOffMinutes(events: Ev[]): Map<string, number> {
  const off = new Map<string, number>();
  const yellows = new Map<string, number>();
  for (const e of sortEvents(events)) {
    if (!e.playerId || e.side !== "us") continue;
    if (e.type === "red" && !off.has(e.playerId)) off.set(e.playerId, e.minute);
    if (e.type === "yellow") {
      const n = (yellows.get(e.playerId) ?? 0) + 1;
      yellows.set(e.playerId, n);
      if (n === 2 && !off.has(e.playerId)) off.set(e.playerId, e.minute);
    }
  }
  return off;
}

/** Who is on the pitch once every event up to (and including) `minute` has happened. */
export function onPitch(starters: string[], events: Ev[], minute = Infinity): string[] {
  const pitch = new Set(starters);
  const sentOff = sendingOffMinutes(events);
  for (const e of sortEvents(events)) {
    if (e.minute > minute) break;
    if (e.type === "sub" && e.playerId && e.relatedPlayerId) {
      pitch.delete(e.playerId);
      pitch.add(e.relatedPlayerId);
    }
  }
  for (const [id, m] of sentOff) if (m <= minute) pitch.delete(id);
  return [...pitch];
}

/** Players who have taken part so far (started or came on). They cannot come back on once off. */
export function playedSoFar(starters: string[], events: Ev[]): Set<string> {
  const played = new Set(starters);
  for (const e of events) if (e.type === "sub" && e.relatedPlayerId) played.add(e.relatedPlayerId);
  return played;
}

/** A message when the event is impossible, otherwise null. Used before saving from the matchday UI. */
export function eventProblem(
  starters: string[],
  events: Ev[],
  next: Pick<Ev, "type" | "side" | "playerId" | "relatedPlayerId">,
  nameOf: (id: string) => string,
): string | null {
  if (next.side === "them") return null;
  const pitch = new Set(onPitch(starters, events));
  const name = (id: string | null) => (id ? nameOf(id) : "");

  if (next.type === "sub") {
    if (!next.playerId || !next.relatedPlayerId) return "Pick who goes off and who comes on.";
    if (!pitch.has(next.playerId)) return `${name(next.playerId)} is not on the pitch.`;
    if (pitch.has(next.relatedPlayerId)) return `${name(next.relatedPlayerId)} is already on the pitch.`;
    if (playedSoFar(starters, events).has(next.relatedPlayerId)) return `${name(next.relatedPlayerId)} has already been substituted off.`;
    return null;
  }
  if (next.type === "goal" || next.type === "own_goal" || next.type === "yellow" || next.type === "red") {
    if (!next.playerId) return next.type === "goal" ? null : "Pick a player.";
    if (!pitch.has(next.playerId)) return `${name(next.playerId)} is not on the pitch.`;
  }
  if (next.type === "goal" && next.relatedPlayerId) {
    if (next.relatedPlayerId === next.playerId) return "A player can't assist their own goal.";
    if (!pitch.has(next.relatedPlayerId)) return `${name(next.relatedPlayerId)} is not on the pitch.`;
  }
  return null;
}

/**
 * Per-player match record. Appearing = starting, coming on, or (when no lineup was saved)
 * being named in an event — in that last case minutes are unknown and stay 0.
 */
export function buildPlayerStats(input: {
  starters: string[];
  events: Ev[];
  durationMinutes: number;
}): PlayerMatchStat[] {
  const { starters, durationMinutes } = input;
  const events = sortEvents(input.events);
  const sentOff = sendingOffMinutes(events);

  const on = new Map<string, number>();   // minute they entered
  const off = new Map<string, number>();  // minute they left
  starters.forEach((id) => on.set(id, 0));
  for (const e of events) {
    if (e.type !== "sub" || !e.playerId || !e.relatedPlayerId) continue;
    off.set(e.playerId, e.minute);
    if (!on.has(e.relatedPlayerId)) on.set(e.relatedPlayerId, e.minute);
  }

  const stats = new Map<string, PlayerMatchStat>();
  const ensure = (playerId: string, started: boolean): PlayerMatchStat => {
    let s = stats.get(playerId);
    if (!s) {
      s = { playerId, started, minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0, ownGoals: 0 };
      stats.set(playerId, s);
    }
    return s;
  };

  for (const id of on.keys()) {
    const s = ensure(id, starters.includes(id));
    const end = Math.min(durationMinutes, off.get(id) ?? durationMinutes, sentOff.get(id) ?? durationMinutes);
    s.minutes = Math.max(0, end - (on.get(id) ?? 0));
  }

  for (const e of events) {
    if (e.side !== "us") continue;
    if (e.type === "goal") {
      if (e.playerId) ensure(e.playerId, false).goals++;
      if (e.relatedPlayerId) ensure(e.relatedPlayerId, false).assists++;
    } else if (e.type === "own_goal" && e.playerId) {
      ensure(e.playerId, false).ownGoals++;
    } else if (e.type === "yellow" && e.playerId) {
      ensure(e.playerId, false).yellow++;
    } else if (e.type === "red" && e.playerId) {
      ensure(e.playerId, false).red++;
    }
  }

  // The database allows at most 2 yellows and 1 red per player per match.
  for (const s of stats.values()) { s.yellow = Math.min(2, s.yellow); s.red = Math.min(1, s.red); }
  return [...stats.values()];
}

/** Minute shown on the matchday clock: counts up from kick-off, capped at the match length (+ stoppage cap). */
export function clockMinute(startedAt: Date | null, now: Date, durationMinutes: number): number {
  if (!startedAt) return 0;
  const m = Math.floor((now.getTime() - startedAt.getTime()) / 60_000) + 1;
  return Math.max(1, Math.min(m, durationMinutes + 15));
}
