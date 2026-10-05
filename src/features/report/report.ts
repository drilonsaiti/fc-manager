import { formatDay, formatTime } from "@/i18n/dates";
import type { Lineup, Match, MatchEvent } from "@/types";
import { fromEntries, startersOf } from "@/features/lineup/lineup";
import { computeScore, onPitch, sortEvents } from "@/features/matchday/stats";

export interface PersonRef { name: string; number: number | null }

/** Every word the report prints. English by default; the UI passes translated labels. */
export interface ReportLabels {
  result: { Win: string; Draw: string; Loss: string };
  competition: Record<string, string>;
  matchReport: string; goals: string; cards: string; subs: string; startingXI: string; bench: string; notes: string;
  assist: string; ownGoal: string; opponent: string; unknownPlayer: string; goalFallback: string;
  yellow: string; red: string; secondYellow: string;
  min: string; goal: string; card: string; substitution: string; no: string; player: string; position: string;
  played: string; cameOn: string; unused: string;
}

export const EN_REPORT_LABELS: ReportLabels = {
  result: { Win: "Win", Draw: "Draw", Loss: "Loss" },
  competition: { league: "League", cup: "Cup", friendly: "Friendly", tournament: "Tournament" },
  matchReport: "MATCH REPORT", goals: "Goals", cards: "Cards", subs: "Substitutions", startingXI: "Starting XI", bench: "Bench", notes: "Notes",
  assist: "assist", ownGoal: "own goal", opponent: "opponent", unknownPlayer: "Unknown player", goalFallback: "Goal",
  yellow: "Yellow card", red: "Red card", secondYellow: "Second yellow (sent off)",
  min: "Min", goal: "Goal", card: "Card", substitution: "Substitution", no: "No.", player: "Player", position: "Position",
  played: "Played", cameOn: "Came on", unused: "Unused",
};

export interface ReportInput {
  teamName: string;
  match: Pick<Match, "opponent" | "kickoff" | "venue" | "competition" | "isHome" | "ourScore" | "theirScore" | "notes" | "durationMinutes">;
  players: Map<string, PersonRef>;
  lineup: Lineup | null;
  events: MatchEvent[];
  locale?: string;
  labels?: ReportLabels;
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

export function buildReport(input: ReportInput): MatchReport {
  const { match, teamName, players } = input;
  const L = input.labels ?? EN_REPORT_LABELS;
  const locale = input.locale ?? "en-GB";
  const events = sortEvents(input.events);
  const name = (id: string | null) => (id ? players.get(id)?.name ?? L.unknownPlayer : null);

  const computed = computeScore(events);
  const ours = match.ourScore ?? computed.us;
  const theirs = match.theirScore ?? computed.them;
  const result = ours > theirs ? "Win" : ours === theirs ? "Draw" : "Loss";

  const goals: MatchReport["goals"] = [];
  for (const e of events) {
    if (e.type === "goal" && e.side === "us") {
      const scorer = name(e.playerId) ?? L.goalFallback;
      const assist = name(e.relatedPlayerId);
      goals.push({ minute: e.minute, forTeam: "us", text: assist ? `${scorer} (${L.assist} ${assist})` : scorer });
    } else if (e.type === "goal") {
      goals.push({ minute: e.minute, forTeam: "them", text: match.opponent });
    } else if (e.type === "own_goal" && e.side === "us") {
      goals.push({ minute: e.minute, forTeam: "them", text: `${name(e.playerId)} (${L.ownGoal})` });
    } else if (e.type === "own_goal") {
      goals.push({ minute: e.minute, forTeam: "us", text: `${L.ownGoal.charAt(0).toUpperCase()}${L.ownGoal.slice(1)} (${match.opponent})` });
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

  const date = formatDay(match.kickoff, locale, { weekday: "long", month: "long", year: true });
  const time = formatTime(match.kickoff);
  const meta = [`${date}, ${time}`, match.venue, L.competition[match.competition]].filter(Boolean).join(" · ");

  const us = { name: teamName, score: ours };
  const them = { name: match.opponent, score: theirs };
  return {
    home: match.isHome ? us : them,
    away: match.isHome ? them : us,
    ours, theirs, result, meta, goals, cards, subs, startingXI, bench,
    notes: match.notes?.trim() || null,
  };
}

/** Plain text for WhatsApp / Viber. */
export function reportToText(r: MatchReport, labels: ReportLabels = EN_REPORT_LABELS): string {
  const cardText = { yellow: labels.yellow, red: labels.red, second_yellow: labels.secondYellow } as const;
  const lines: string[] = [
    `${r.home.name} ${r.home.score} – ${r.away.score} ${r.away.name}`,
    `${labels.result[r.result]} · ${r.meta}`,
  ];
  if (r.goals.length) {
    lines.push("", `⚽ ${labels.goals}`, ...r.goals.map((g) => `${g.minute}' ${g.text}`));
  }
  if (r.cards.length) lines.push("", `🟨 ${labels.cards}`, ...r.cards.map((c) => `${c.minute}' ${c.player} — ${cardText[c.kind]}`));
  if (r.subs.length) lines.push("", `🔁 ${labels.subs}`, ...r.subs.map((s) => `${s.minute}' ${s.off} ➜ ${s.on}`));
  if (r.startingXI.length) {
    lines.push("", labels.startingXI, r.startingXI.map((p) => `${p.number != null ? `#${p.number} ` : ""}${p.name}`).join(", "));
  }
  if (r.bench.length) lines.push(`${labels.bench}: ` + r.bench.map((p) => p.name).join(", "));
  if (r.notes) lines.push("", r.notes);
  return lines.join("\n");
}
