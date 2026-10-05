import { describe, expect, it } from "vitest";
import { buildReport, reportToText, type ReportInput } from "./report";
import { buildReportPdf, reportFileName } from "./pdf";
import type { EventType, MatchEvent, Side } from "@/types";

const players = new Map([
  ["gk", { name: "Keeper", number: 1 }], ["d1", { name: "Dardan", number: 4 }], ["f1", { name: "Fatos", number: 9 }],
  ["m1", { name: "Mirlind", number: 8 }], ["s1", { name: "Sub", number: 14 }], ["s2", { name: "Unused", number: 15 }],
]);

let n = 0;
const ev = (type: EventType, minute: number, playerId: string | null = null, relatedPlayerId: string | null = null, side: Side = "us"): MatchEvent =>
  ({ id: `e${n++}`, matchId: "m", type, side, minute, playerId, relatedPlayerId, createdAt: new Date(n) });

const base = (over: Partial<ReportInput> = {}): ReportInput => ({
  teamName: "FC Test",
  match: { opponent: "Rivals", kickoff: new Date(2026, 9, 11, 15, 0), venue: "Main pitch", competition: "league", isHome: true, ourScore: 2, theirScore: 1, notes: "Great spirit.", durationMinutes: 90 },
  players,
  lineup: {
    matchId: "m", formation: "4-4-2",
    entries: [
      { playerId: "gk", role: "starter", slotId: "GK", x: 50, y: 90, sort: 0 },
      { playerId: "f1", role: "starter", slotId: "L2_0", x: 36, y: 14, sort: 0 },
      { playerId: "s1", role: "bench", slotId: null, x: null, y: null, sort: 0 },
      { playerId: "s2", role: "bench", slotId: null, x: null, y: null, sort: 1 },
    ],
  },
  events: [
    ev("goal", 12, "f1", "m1"), ev("goal", 34, null, null, "them"), ev("goal", 70, "f1"),
    ev("yellow", 40, "d1"), ev("yellow", 60, "d1"), ev("sub", 65, "gk", "s1"),
  ],
  ...over,
});

describe("buildReport", () => {
  const r = buildReport(base());

  it("uses the stored final score and labels the result", () => {
    expect(r.ours).toBe(2);
    expect(r.theirs).toBe(1);
    expect(r.result).toBe("Win");
    expect(r.home).toEqual({ name: "FC Test", score: 2 });
    expect(r.away).toEqual({ name: "Rivals", score: 1 });
  });

  it("puts the away side second when we are away", () => {
    const away = buildReport(base({ match: { ...base().match, isHome: false } }));
    expect(away.home).toEqual({ name: "Rivals", score: 1 });
    expect(away.away).toEqual({ name: "FC Test", score: 2 });
  });

  it("falls back to the events when no score is stored", () => {
    const live = buildReport(base({ match: { ...base().match, ourScore: null, theirScore: null } }));
    expect([live.ours, live.theirs]).toEqual([2, 1]);
  });

  it("lists goals in order with assists, opponent goals and own goals", () => {
    expect(r.goals.map((g) => `${g.minute} ${g.forTeam} ${g.text}`)).toEqual([
      "12 us Fatos (assist Mirlind)", "34 them Rivals", "70 us Fatos",
    ]);
    const og = buildReport(base({ events: [ev("own_goal", 20, "d1"), ev("own_goal", 30, null, null, "them")] }));
    expect(og.goals).toEqual([
      { minute: 20, forTeam: "them", text: "Dardan (own goal)" },
      { minute: 30, forTeam: "us", text: "Own goal (Rivals)" },
    ]);
  });

  it("marks a second yellow as a sending off", () => {
    expect(r.cards.map((c) => c.kind)).toEqual(["yellow", "second_yellow"]);
  });

  it("lists substitutions, the XI in formation order, and who from the bench played", () => {
    expect(r.subs).toEqual([{ minute: 65, off: "Keeper", on: "Sub" }]);
    expect(r.startingXI.map((p) => p.name)).toEqual(["Keeper", "Fatos"]);
    expect(r.bench).toEqual([
      { number: 14, name: "Sub", played: true },
      { number: 15, name: "Unused", played: false },
    ]);
  });

  it("works with no lineup and no events", () => {
    const empty = buildReport(base({ lineup: null, events: [], match: { ...base().match, ourScore: 0, theirScore: 0, notes: null } }));
    expect(empty.result).toBe("Draw");
    expect(empty.startingXI).toEqual([]);
    expect(empty.notes).toBeNull();
  });

  it("shows 'Unknown player' rather than crashing on a deleted player", () => {
    const x = buildReport(base({ events: [ev("goal", 5, "ghost")] }));
    expect(x.goals[0].text).toBe("Unknown player");
  });
});

describe("reportToText", () => {
  const text = reportToText(buildReport(base()));
  it("reads like a message you would send to the group", () => {
    expect(text.split("\n")[0]).toBe("FC Test 2 – 1 Rivals");
    expect(text).toContain("Win · ");
    expect(text).toContain("12' Fatos (assist Mirlind)");
    expect(text).toContain("60' Dardan — Second yellow (sent off)");
    expect(text).toContain("65' Keeper ➜ Sub");
    expect(text).toContain("Great spirit.");
    expect(text).not.toContain("⟵");
  });
});

describe("pdf", () => {
  it("renders a non-empty PDF and a safe file name", () => {
    const r = buildReport(base());
    const doc = buildReportPdf(r);
    const bytes = new Uint8Array(doc.output("arraybuffer"));
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1500);
    expect(reportFileName(r)).toBe("fc-test-vs-rivals.pdf");
  });
  it("still renders when there is nothing but a score", () => {
    const r = buildReport(base({ lineup: null, events: [], match: { ...base().match, notes: null } }));
    expect(() => buildReportPdf(r)).not.toThrow();
  });
});
