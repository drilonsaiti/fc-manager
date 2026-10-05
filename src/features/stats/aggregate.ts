import type { Match, Player, SeasonPlayerStat } from "@/types";

export interface PlayerSeasonRow {
  playerId: string;
  name: string;
  number: number | null;
  active: boolean;
  appearances: number;
  starts: number;
  subAppearances: number;
  minutes: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  wins: number;
  draws: number;
  losses: number;
  /** goals ÷ appearances; null until they have played. */
  goalsPerApp: number | null;
  /** minutes ÷ goals; null until they have scored. */
  minutesPerGoal: number | null;
  /** starts ÷ the team's matches played. */
  startPct: number | null;
  trainingsAttended: number;
  /** attended ÷ training sessions held; null until there has been a session. */
  attendancePct: number | null;
}

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

export function buildSeasonTable(input: {
  players: Player[];
  stats: SeasonPlayerStat[];
  attended: Map<string, number>;
  trainingsHeld: number;
  matchesPlayed: number;
}): PlayerSeasonRow[] {
  const { players, stats, attended, trainingsHeld, matchesPlayed } = input;
  const byPlayer = new Map(stats.map((s) => [s.playerId, s]));

  // Everyone in the active squad, plus anyone who left but has numbers this season.
  const rows = players
    .filter((p) => p.active || byPlayer.has(p.id) || attended.has(p.id))
    .map((p): PlayerSeasonRow => {
      const s = byPlayer.get(p.id);
      const a = s?.appearances ?? 0;
      const goals = s?.goals ?? 0;
      const minutes = s?.minutes ?? 0;
      const tr = attended.get(p.id) ?? 0;
      return {
        playerId: p.id, name: p.name, number: p.number, active: p.active,
        appearances: a, starts: s?.starts ?? 0, subAppearances: s?.subAppearances ?? 0,
        minutes, goals, assists: s?.assists ?? 0, yellow: s?.yellow ?? 0, red: s?.red ?? 0,
        wins: s?.wins ?? 0, draws: s?.draws ?? 0, losses: s?.losses ?? 0,
        goalsPerApp: a > 0 ? round(goals / a) : null,
        minutesPerGoal: goals > 0 ? Math.round(minutes / goals) : null,
        startPct: pct(s?.starts ?? 0, matchesPlayed),
        trainingsAttended: tr,
        attendancePct: pct(tr, trainingsHeld),
      };
    });

  return rows.sort((a, b) =>
    b.goals - a.goals || b.assists - a.assists || b.appearances - a.appearances || a.name.localeCompare(b.name));
}

export interface TeamSummary {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export function buildTeamSummary(matches: Pick<Match, "status" | "ourScore" | "theirScore">[]): TeamSummary {
  const s: TeamSummary = { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
  for (const m of matches) {
    if (m.status !== "final" || m.ourScore == null || m.theirScore == null) continue;
    s.played++;
    s.goalsFor += m.ourScore;
    s.goalsAgainst += m.theirScore;
    if (m.ourScore > m.theirScore) { s.wins++; s.points += 3; }
    else if (m.ourScore === m.theirScore) { s.draws++; s.points += 1; }
    else s.losses++;
  }
  return s;
}

export function resultLetter(m: Pick<Match, "ourScore" | "theirScore">): "W" | "D" | "L" | null {
  if (m.ourScore == null || m.theirScore == null) return null;
  return m.ourScore > m.theirScore ? "W" : m.ourScore === m.theirScore ? "D" : "L";
}
