import type { Lineup, Match, MatchEvent } from "@/types";
import { fromEntries, startersOf } from "@/features/lineup/lineup";
import { computeScore, onPitch, sortEvents } from "@/features/matchday/stats";

export interface PersonRef { name: string; number: number | null }

export interface ReportInput {
  teamName: string;
  match: Pick<Match, "opponent" | "kickoff" | "venue" | "competition" | "isHome" | "ourScore" | "theirScore" | "notes" | "durationMinutes">;
  players: Map<string, PersonRef>;
  lineup: Lineup | null;
  events: MatchEvent[];
}

export interface MatchReport {
  home: { name: string; score: number };
  away: { name: string; score: number };
  ours: number;
  theirs: number;
  result: "Win" | "Draw" | "Loss";
  meta: string;
  goals: { minute: number; forTeam: "us" | "them"; text: string }[];
  cards: { minute: number; kind: "yellow" | "red" | "second_yellow"; player: string }[];
  subs: { minute: number; off: string; on: string }[];
  startingXI: { label: string; number: number | null; name: string }[];
  bench: { number: number | null; name: string; played: boolean }[];
  notes: string | null;
}

const COMPETITION: Record<string, string> = { league: "League", cup: "Cup", friendly: "Friendly", tournament: "Tournament" };

export function buildReport(input: ReportInput): MatchReport {
  const { match, teamName, players } = input;
  const events = sortEvents(input.events);
  const name = (id: string | null) => (id ? players.get(id)?.name ?? "Unknown player" : null);

  const computed = computeScore(events);
  const ours = match.ourScore ?? computed.us;
  const theirs = match.theirScore ?? computed.them;
  const result = ours > theirs ? "Win" : ours === theirs ? "Draw" : "Loss";

  const goals: MatchReport["goals"] = [];
  for (const e of events) {
    if (e.type === "goal" && e.side === "us") {
      const scorer = name(e.playerId) ?? "Goal";
      const assist = name(e.relatedPlayerId);
      goals.push({ minute: e.minute, forTeam: "us", text: assist ? `${scorer} (assist ${assist})` : scorer });
    } else if (e.type === "goal") {
      goals.push({ minute: e.minute, forTeam: "them", text: match.opponent });
    } else if (e.type === "own_goal" && e.side === "us") {
      goals.push({ minute: e.minute, forTeam: "them", text: `${name(e.playerId)} (own goal)` });
    } else if (e.type === "own_goal") {
      goals.push({ minute: e.minute, forTeam: "us", text: `Own goal (${match.opponent})` });
    }
  }

  const cards: MatchReport["cards"] = [];
  const yellows = new Map<string, number>();
  for (const e of events) {
    if (!e.playerId || e.side !== "us") continue;
    if (e.type === "yellow") {
      const n = (yellows.get(e.playerId) ?? 0) + 1;
      yellows.set(e.playerId, n);
      cards.push({ minute: e.minute, kind: n >= 2 ? "second_yellow" : "yellow", player: name(e.playerId)! });
    } else if (e.type === "red") {
      cards.push({ minute: e.minute, kind: "red", player: name(e.playerId)! });
    }
  }

  const subs = events
    .filter((e) => e.type === "sub" && e.playerId && e.relatedPlayerId)
    .map((e) => ({ minute: e.minute, off: name(e.playerId)!, on: name(e.relatedPlayerId)! }));

  let startingXI: MatchReport["startingXI"] = [];
  let bench: MatchReport["bench"] = [];
  if (input.lineup) {
    const state = fromEntries(input.lineup.formation, input.lineup.entries);
    startingXI = startersOf(state).map(({ slot, playerId }) => ({
      label: slot.label, number: players.get(playerId)?.number ?? null, name: name(playerId)!,
    }));
    const played = new Set(onPitch([], events.filter((e) => e.type === "sub"))); // came on at some point
    bench = state.bench.map((id) => ({
      number: players.get(id)?.number ?? null, name: name(id)!,
      played: played.has(id) || subs.some((s) => s.on === name(id)),
    }));
  }

  const date = match.kickoff.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const time = match.kickoff.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  const meta = [`${date}, ${time}`, match.venue, COMPETITION[match.competition]].filter(Boolean).join(" · ");

  const us = { name: teamName, score: ours };
  const them = { name: match.opponent, score: theirs };
  return {
    home: match.isHome ? us : them,
    away: match.isHome ? them : us,
    ours, theirs, result, meta, goals, cards, subs, startingXI, bench,
    notes: match.notes?.trim() || null,
  };
}

const CARD_TEXT = { yellow: "Yellow", red: "Red", second_yellow: "Second yellow (sent off)" } as const;

/** Plain text for WhatsApp / Viber. */
export function reportToText(r: MatchReport): string {
  const lines: string[] = [
    `${r.home.name} ${r.home.score} – ${r.away.score} ${r.away.name}`,
    `${r.result} · ${r.meta}`,
  ];
  if (r.goals.length) {
    lines.push("", "⚽ Goals", ...r.goals.map((g) => `${g.minute}' ${g.text}`));
  }
  if (r.cards.length) lines.push("", "🟨 Cards", ...r.cards.map((c) => `${c.minute}' ${c.player} — ${CARD_TEXT[c.kind]}`));
  if (r.subs.length) lines.push("", "🔁 Substitutions", ...r.subs.map((s) => `${s.minute}' ${s.off} ➜ ${s.on}`));
  if (r.startingXI.length) {
    lines.push("", "Starting XI", r.startingXI.map((p) => `${p.number != null ? `#${p.number} ` : ""}${p.name}`).join(", "));
  }
  if (r.bench.length) lines.push("Bench: " + r.bench.map((p) => p.name).join(", "));
  if (r.notes) lines.push("", r.notes);
  return lines.join("\n");
}
