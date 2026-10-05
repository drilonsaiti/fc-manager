import { describe, expect, it } from "vitest";
import { buildPost, teamTag } from "./post";
import { buildReport } from "@/features/report/report";
import type { Lineup, MatchEvent } from "@/types";

const match = {
  opponent: "KF Rivals", kickoff: new Date("2026-10-10T16:00:00"), venue: "City Stadium", competition: "league" as const,
  isHome: true, ourScore: 3, theirScore: 1, notes: null, durationMinutes: 90,
};
const players = new Map([
  ["g", { name: "Gjoni", number: 1 }], ["a", { name: "Ardit", number: 9 }], ["b", { name: "Besnik", number: 10 }],
]);
const ev = (o: Partial<MatchEvent>): MatchEvent => ({
  id: crypto.randomUUID(), matchId: "m", type: "goal", side: "us", minute: 10, playerId: null, relatedPlayerId: null, createdAt: new Date(), ...o,
});
const lineup: Lineup = {
  matchId: "m", formation: "4-4-2",
  entries: [
    { playerId: "g", role: "starter", slotId: "GK", x: 50, y: 90, sort: 0 },
    { playerId: "a", role: "starter", slotId: "L2_0", x: 30, y: 14, sort: 1 },
    { playerId: "b", role: "bench", slotId: null, x: null, y: null, sort: 2 },
  ],
};
const report = buildReport({
  teamName: "FC Test", match, players, lineup,
  events: [ev({ minute: 12, playerId: "a", relatedPlayerId: "b" }), ev({ minute: 40, playerId: "a" }), ev({ minute: 70, playerId: "b" }), ev({ minute: 80, side: "them" })],
});
const input = { teamName: "FC Test", report, lineup, when: "Saturday 10 October, 16:00", venue: "City Stadium", competition: "League" };

describe("teamTag", () => {
  it("builds a hashtag in any alphabet", () => {
    expect(teamTag("FC Test")).toBe("#FCTest");
    expect(teamTag("КФ Вардар-Југ")).toBe("#КФВардарЈуг");
    expect(teamTag("KF Shqipëria U19")).toBe("#KFShqipëriaU19");
    expect(teamTag("!!!")).toBe("");
  });
});

describe("buildPost", () => {
  it("announces the match with date, place and competition", () => {
    const p = buildPost("announce", input);
    expect(p).toContain("MATCHDAY");
    expect(p).toContain("FC Test vs KF Rivals");
    expect(p).toContain("📅 Saturday 10 October, 16:00");
    expect(p).toContain("📍 City Stadium");
    expect(p).toContain("🏆 League");
    expect(p).toContain("#FCTest #football");
  });
  it("puts the away side first when we play away", () => {
    const away = buildReport({ teamName: "FC Test", match: { ...match, isHome: false }, players, lineup: null, events: [] });
    expect(buildPost("announce", { ...input, report: away })).toContain("KF Rivals vs FC Test");
  });
  it("lists the starters by line and the bench", () => {
    const p = buildPost("lineup", input);
    expect(p).toContain("4-4-2");
    expect(p).toContain("GK: #1 Gjoni");
    expect(p).toContain("FWD: #9 Ardit");
    expect(p).toContain("Bench: Besnik");
  });
  it("reports the result with scorers and assists", () => {
    const p = buildPost("result", input);
    expect(p).toContain("FC Test 3 – 1 KF Rivals");
    expect(p).toContain("Victory!");
    expect(p).toContain("12' Ardit (assist Besnik)");
    expect(p).not.toContain("KF Rivals)"); // their goals are not listed as scorers
  });
  it("writes in the labels it is given", () => {
    const p = buildPost("announce", { ...input, labels: { ...(await_labels()), matchday: "DITA E NDESHJES", tag: "#futboll" } });
    expect(p).toContain("DITA E NDESHJES");
    expect(p).toContain("#FCTest #futboll");
  });
});

function await_labels() {
  return {
    matchday: "", cta: "", startingXI: "", bench: "", fullTime: "", win: "", draw: "", loss: "", goals: "", redCard: "", thanks: "", tag: "",
    roles: { GK: "", DEF: "", MID: "", FWD: "" },
  };
}
