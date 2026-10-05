import { describe, expect, it } from "vitest";
import { buildPlayerStats, clockMinute, computeScore, eventProblem, onPitch, playedSoFar, sortEvents } from "./stats";
import type { EventType, Side } from "@/types";

const ev = (type: EventType, minute: number, playerId: string | null = null, relatedPlayerId: string | null = null, side: Side = "us") =>
  ({ type, side, minute, playerId, relatedPlayerId });

const XI = ["gk", "d1", "d2", "d3", "d4", "m1", "m2", "m3", "m4", "f1", "f2"];
const stat = (stats: ReturnType<typeof buildPlayerStats>, id: string) => stats.find((s) => s.playerId === id)!;

describe("computeScore", () => {
  it("counts goals for both sides", () => {
    expect(computeScore([ev("goal", 5, "f1"), ev("goal", 20, "f2"), ev("goal", 30, null, null, "them")])).toEqual({ us: 2, them: 1 });
  });
  it("an own goal by us counts for them, by them counts for us", () => {
    expect(computeScore([ev("own_goal", 10, "d1"), ev("own_goal", 20, null, null, "them")])).toEqual({ us: 1, them: 1 });
  });
  it("cards and subs never change the score", () => {
    expect(computeScore([ev("yellow", 1, "d1"), ev("red", 2, "d2"), ev("sub", 3, "m1", "m5")])).toEqual({ us: 0, them: 0 });
  });
  it("is 0–0 with no events", () => expect(computeScore([])).toEqual({ us: 0, them: 0 }));
});

describe("sortEvents", () => {
  it("orders by minute and keeps the recorded order within a minute", () => {
    const a = ev("goal", 30, "a"), b = ev("yellow", 10, "b"), c = ev("goal", 30, "c");
    expect(sortEvents([a, b, c]).map((e) => e.playerId)).toEqual(["b", "a", "c"]);
  });
});

describe("onPitch", () => {
  it("applies substitutions in order", () => {
    const events = [ev("sub", 60, "f1", "s1"), ev("sub", 75, "s1", "s2")];
    expect(onPitch(XI, events, 59)).toContain("f1");
    expect(onPitch(XI, events, 60)).toContain("s1");
    expect(onPitch(XI, events, 60)).not.toContain("f1");
    const end = onPitch(XI, events);
    expect(end).toContain("s2");
    expect(end).not.toContain("s1");
    expect(end).toHaveLength(11);
  });
  it("a red card or a second yellow removes the player", () => {
    expect(onPitch(XI, [ev("red", 30, "d1")])).toHaveLength(10);
    const twoYellows = [ev("yellow", 20, "m1"), ev("yellow", 50, "m1")];
    expect(onPitch(XI, twoYellows, 49)).toContain("m1");
    expect(onPitch(XI, twoYellows, 50)).not.toContain("m1");
    expect(onPitch(XI, [ev("yellow", 20, "m1")])).toContain("m1");
  });
});

describe("buildPlayerStats — minutes", () => {
  it("a starter who plays everything gets the full match", () => {
    expect(stat(buildPlayerStats({ starters: XI, events: [], durationMinutes: 90 }), "gk")).toMatchObject({ started: true, minutes: 90 });
  });
  it("a substituted player stops at the sub minute; the replacement starts there", () => {
    const stats = buildPlayerStats({ starters: XI, events: [ev("sub", 60, "f1", "s1")], durationMinutes: 90 });
    expect(stat(stats, "f1").minutes).toBe(60);
    expect(stat(stats, "s1")).toMatchObject({ started: false, minutes: 30 });
  });
  it("players who never get on do not appear", () => {
    const stats = buildPlayerStats({ starters: XI, events: [], durationMinutes: 90 });
    expect(stats).toHaveLength(11);
  });
  it("a red card ends the game for that player", () => {
    expect(stat(buildPlayerStats({ starters: XI, events: [ev("red", 70, "d1")], durationMinutes: 90 }), "d1")).toMatchObject({ minutes: 70, red: 1 });
  });
  it("a second yellow ends the game too, and both yellows are recorded", () => {
    const s = stat(buildPlayerStats({ starters: XI, events: [ev("yellow", 20, "m1"), ev("yellow", 55, "m1")], durationMinutes: 90 }), "m1");
    expect(s).toMatchObject({ minutes: 55, yellow: 2, red: 0 });
  });
  it("a substitute who is sent off counts minutes until the card", () => {
    const stats = buildPlayerStats({ starters: XI, events: [ev("sub", 50, "f1", "s1"), ev("red", 80, "s1")], durationMinutes: 90 });
    expect(stat(stats, "s1").minutes).toBe(30);
  });
  it("respects a shorter match length", () => {
    const stats = buildPlayerStats({ starters: XI, events: [ev("sub", 30, "f1", "s1")], durationMinutes: 80 });
    expect(stat(stats, "gk").minutes).toBe(80);
    expect(stat(stats, "s1").minutes).toBe(50);
  });
  it("never produces negative minutes if a sub is recorded after the end", () => {
    const stats = buildPlayerStats({ starters: XI, events: [ev("sub", 95, "f1", "s1")], durationMinutes: 90 });
    expect(stat(stats, "s1").minutes).toBe(0);
    expect(stat(stats, "f1").minutes).toBe(90);
  });
});

describe("buildPlayerStats — events", () => {
  it("counts goals, assists, own goals and cards per player", () => {
    const stats = buildPlayerStats({
      starters: XI, durationMinutes: 90,
      events: [
        ev("goal", 10, "f1", "m1"), ev("goal", 40, "f1", "m2"), ev("goal", 70, "f2"),
        ev("own_goal", 50, "d1"), ev("yellow", 33, "d2"), ev("goal", 80, null, null, "them"),
      ],
    });
    expect(stat(stats, "f1").goals).toBe(2);
    expect(stat(stats, "f2")).toMatchObject({ goals: 1, assists: 0 });
    expect(stat(stats, "m1").assists).toBe(1);
    expect(stat(stats, "d1").ownGoals).toBe(1);
    expect(stat(stats, "d2").yellow).toBe(1);
    expect(stats.reduce((n, s) => n + s.goals, 0)).toBe(3); // opponent goals are not attributed to anyone
  });
  it("opponent events never create player rows", () => {
    expect(buildPlayerStats({ starters: [], events: [ev("goal", 5, null, null, "them")], durationMinutes: 90 })).toEqual([]);
  });
  it("a scorer with no lineup saved still appears (minutes unknown)", () => {
    const stats = buildPlayerStats({ starters: [], events: [ev("goal", 5, "x")], durationMinutes: 90 });
    expect(stats).toEqual([{ playerId: "x", started: false, minutes: 0, goals: 1, assists: 0, yellow: 0, red: 0, ownGoals: 0 }]);
  });
  it("caps cards at what the database allows", () => {
    const s = stat(buildPlayerStats({
      starters: XI, durationMinutes: 90,
      events: [ev("yellow", 1, "d1"), ev("yellow", 2, "d1"), ev("yellow", 3, "d1"), ev("red", 4, "d1"), ev("red", 5, "d1")],
    }), "d1");
    expect([s.yellow, s.red]).toEqual([2, 1]);
  });
});

describe("eventProblem", () => {
  const name = (id: string) => id.toUpperCase();
  const check = (events: ReturnType<typeof ev>[], next: Parameters<typeof eventProblem>[2]) => eventProblem(XI, events, next, name);

  it("allows ordinary events", () => {
    expect(check([], { type: "goal", side: "us", playerId: "f1", relatedPlayerId: "m1" })).toBeNull();
    expect(check([], { type: "goal", side: "us", playerId: null, relatedPlayerId: null })).toBeNull(); // unknown scorer
    expect(check([], { type: "goal", side: "them", playerId: null, relatedPlayerId: null })).toBeNull();
  });
  it("blocks events for a player who is not on the pitch", () => {
    expect(check([ev("sub", 60, "f1", "s1")], { type: "goal", side: "us", playerId: "f1", relatedPlayerId: null })).toMatch(/not on the pitch/);
    expect(check([], { type: "yellow", side: "us", playerId: "bench", relatedPlayerId: null })).toMatch(/not on the pitch/);
    expect(check([ev("red", 10, "d1")], { type: "yellow", side: "us", playerId: "d1", relatedPlayerId: null })).toMatch(/not on the pitch/);
  });
  it("a player cannot assist their own goal", () => {
    expect(check([], { type: "goal", side: "us", playerId: "f1", relatedPlayerId: "f1" })).toMatch(/own goal/);
  });
  it("substitutions: must go off from the pitch, come on from outside, once", () => {
    expect(check([], { type: "sub", side: "us", playerId: "f1", relatedPlayerId: "s1" })).toBeNull();
    expect(check([], { type: "sub", side: "us", playerId: "s1", relatedPlayerId: "s2" })).toMatch(/not on the pitch/);
    expect(check([], { type: "sub", side: "us", playerId: "f1", relatedPlayerId: "f2" })).toMatch(/already on the pitch/);
    expect(check([ev("sub", 60, "f1", "s1")], { type: "sub", side: "us", playerId: "f2", relatedPlayerId: "f1" })).toMatch(/already been substituted off/);
    expect(check([], { type: "sub", side: "us", playerId: null, relatedPlayerId: "s1" })).toMatch(/who goes off/);
  });
  it("playedSoFar tracks starters and players who came on", () => {
    expect(playedSoFar(["a"], [ev("sub", 60, "a", "b")])).toEqual(new Set(["a", "b"]));
  });
});

describe("clockMinute", () => {
  const start = new Date("2026-10-11T15:00:00Z");
  it("is 0 before kick-off and counts up from minute 1", () => {
    expect(clockMinute(null, start, 90)).toBe(0);
    expect(clockMinute(start, start, 90)).toBe(1);
    expect(clockMinute(start, new Date(start.getTime() + 59_000), 90)).toBe(1);
    expect(clockMinute(start, new Date(start.getTime() + 60_000), 90)).toBe(2);
    expect(clockMinute(start, new Date(start.getTime() + 44 * 60_000), 90)).toBe(45);
  });
  it("stops counting a little after full time", () => {
    expect(clockMinute(start, new Date(start.getTime() + 5 * 3600_000), 90)).toBe(105);
  });
});
