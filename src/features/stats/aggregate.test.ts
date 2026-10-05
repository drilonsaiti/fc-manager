import { describe, expect, it } from "vitest";
import { buildSeasonTable, buildTeamSummary, resultLetter } from "./aggregate";
import type { Player, SeasonPlayerStat } from "@/types";

const player = (id: string, name: string, active = true): Player =>
  ({ id, teamId: "t", name, number: null, positions: [], phone: null, active });
const stat = (playerId: string, o: Partial<SeasonPlayerStat> = {}): SeasonPlayerStat => ({
  playerId, appearances: 0, starts: 0, subAppearances: 0, minutes: 0, goals: 0, assists: 0,
  yellow: 0, red: 0, ownGoals: 0, wins: 0, draws: 0, losses: 0, ...o,
});

describe("buildSeasonTable", () => {
  const players = [player("a", "Ardit"), player("b", "Besnik"), player("c", "Ermal"), player("old", "Gone", false), player("gone0", "Quiet", false)];
  const table = buildSeasonTable({
    players,
    stats: [
      stat("a", { appearances: 4, starts: 3, subAppearances: 1, minutes: 300, goals: 3, assists: 1 }),
      stat("b", { appearances: 5, starts: 5, minutes: 450, goals: 3, assists: 4 }),
      stat("old", { appearances: 1, starts: 1, minutes: 90, goals: 1 }),
    ],
    attended: new Map([["a", 6], ["b", 3]]),
    trainingsHeld: 8,
    matchesPlayed: 5,
  });
  const row = (id: string) => table.find((r) => r.playerId === id)!;

  it("derives per-game numbers only when there is something to divide", () => {
    expect(row("a").goalsPerApp).toBe(0.75);
    expect(row("a").minutesPerGoal).toBe(100);
    expect(row("c").goalsPerApp).toBeNull();
    expect(row("c").minutesPerGoal).toBeNull();
  });
  it("start % is relative to the team's matches, attendance % to sessions held", () => {
    expect(row("a").startPct).toBe(60);
    expect(row("b").startPct).toBe(100);
    expect(row("a").attendancePct).toBe(75);
    expect(row("c").attendancePct).toBe(0);
  });
  it("includes squad members with no games, and ex-players only when they have numbers", () => {
    expect(row("c")).toMatchObject({ appearances: 0, goals: 0 });
    expect(row("old")).toBeDefined();
    expect(table.find((r) => r.playerId === "gone0")).toBeUndefined();
  });
  it("sorts by goals, then assists, then appearances, then name", () => {
    expect(table.map((r) => r.playerId).slice(0, 2)).toEqual(["b", "a"]); // both 3 goals, b has more assists
    expect(table[table.length - 1].playerId).toBe("c");
  });
  it("no matches or sessions yet gives null percentages, not NaN or Infinity", () => {
    const empty = buildSeasonTable({ players: [player("a", "A")], stats: [], attended: new Map(), trainingsHeld: 0, matchesPlayed: 0 });
    expect(empty[0].startPct).toBeNull();
    expect(empty[0].attendancePct).toBeNull();
  });
});

describe("buildTeamSummary", () => {
  it("scores 3/1/0 points and ignores matches that are not final", () => {
    const s = buildTeamSummary([
      { status: "final", ourScore: 3, theirScore: 1 },
      { status: "final", ourScore: 1, theirScore: 1 },
      { status: "final", ourScore: 0, theirScore: 2 },
      { status: "scheduled", ourScore: null, theirScore: null },
      { status: "cancelled", ourScore: null, theirScore: null },
      { status: "live", ourScore: null, theirScore: null },
    ]);
    expect(s).toEqual({ played: 3, wins: 1, draws: 1, losses: 1, goalsFor: 4, goalsAgainst: 4, points: 4 });
  });
  it("handles an empty season", () => {
    expect(buildTeamSummary([]).played).toBe(0);
  });
});

describe("resultLetter", () => {
  it("maps scores to W/D/L", () => {
    expect(resultLetter({ ourScore: 2, theirScore: 1 })).toBe("W");
    expect(resultLetter({ ourScore: 1, theirScore: 1 })).toBe("D");
    expect(resultLetter({ ourScore: 0, theirScore: 1 })).toBe("L");
    expect(resultLetter({ ourScore: null, theirScore: null })).toBeNull();
  });
});
