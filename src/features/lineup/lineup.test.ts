import { describe, expect, it } from "vitest";
import { PRESET_FORMATIONS, buildFormation, getFormation, parseFormation } from "./formations";
import {
  benchPlayer, changeFormation, emptyLineup, fromEntries, keepOnly, movePlayer, placePlayer,
  placeNearest, playerIds, removePlayer, resetLineup, slotOfPlayer, startersOf, toEntries, validateLineup,
} from "./lineup";

describe("formations", () => {
  it.each(PRESET_FORMATIONS)("%s has 11 slots, one keeper, unique ids and on-pitch coordinates", (key) => {
    const f = buildFormation(key)!;
    expect(f.slots).toHaveLength(11);
    expect(f.slots.filter((s) => s.role === "GK")).toHaveLength(1);
    expect(new Set(f.slots.map((s) => s.id)).size).toBe(11);
    for (const s of f.slots) {
      expect(s.x).toBeGreaterThanOrEqual(0); expect(s.x).toBeLessThanOrEqual(100);
      expect(s.y).toBeGreaterThanOrEqual(0); expect(s.y).toBeLessThanOrEqual(100);
    }
  });

  it("puts the right number of players in each line, keeper deepest, attackers highest", () => {
    const f = buildFormation("4-3-3")!;
    const count = (role: string) => f.slots.filter((s) => s.role === role).length;
    expect([count("GK"), count("DEF"), count("MID"), count("FWD")]).toEqual([1, 4, 3, 3]);
    const y = (role: string) => f.slots.find((s) => s.role === role)!.y;
    expect(y("GK")).toBeGreaterThan(y("DEF"));
    expect(y("DEF")).toBeGreaterThan(y("MID"));
    expect(y("MID")).toBeGreaterThan(y("FWD"));
  });

  it("supports multi-line midfields", () => {
    const f = buildFormation("4-2-3-1")!;
    expect(f.slots.filter((s) => s.role === "MID")).toHaveLength(5);
    expect(f.slots.filter((s) => s.label === "DM")).toHaveLength(2);
    expect(f.slots.filter((s) => s.label === "AM")).toHaveLength(1);
    // 4-4-1-1: the player behind the striker sits on the second midfield line (an attacking midfielder)
    const f2 = buildFormation("4-4-1-1")!;
    expect(f2.slots.filter((s) => s.role === "MID")).toHaveLength(5);
    expect(f2.slots.filter((s) => s.role === "FWD")).toHaveLength(1);
    expect(f2.slots.filter((s) => s.label === "AM")).toHaveLength(1);
  });

  it("accepts custom formations and rejects invalid ones", () => {
    expect(getFormation("4-1-4-1")).not.toBeNull();
    expect(getFormation("3-4-1-2")).not.toBeNull();
    for (const bad of ["4-4-3", "abc", "10", "10-0", "4-4", "4-3-3-0", "", "4-3-3-"]) expect(parseFormation(bad)).toBeNull();
  });

  it("keeps players on the pitch away from the same spot", () => {
    for (const key of PRESET_FORMATIONS) {
      const f = buildFormation(key)!;
      const spots = new Set(f.slots.map((s) => `${s.x},${s.y}`));
      expect(spots.size).toBe(11);
    }
  });
});

describe("lineup operations", () => {
  const f = getFormation("4-4-2")!;
  const slot = (label: string, n = 0) => f.slots.filter((s) => s.label === label)[n].id;

  it("placing into an occupied slot sends the previous player to the bench", () => {
    let s = emptyLineup("4-4-2");
    s = placePlayer(s, "GK", "a");
    s = placePlayer(s, "GK", "b");
    expect(s.slots.GK).toBe("b");
    expect(s.bench).toEqual(["a"]);
  });

  it("moving a starter into an occupied slot swaps the two", () => {
    let s = emptyLineup("4-4-2");
    s = placePlayer(s, slot("LB"), "a");
    s = placePlayer(s, slot("RB"), "b");
    s = placePlayer(s, slot("RB"), "a");
    expect(s.slots[slot("RB")]).toBe("a");
    expect(s.slots[slot("LB")]).toBe("b");
    expect(s.bench).toEqual([]);
  });

  it("a player is never in two places", () => {
    let s = emptyLineup("4-4-2");
    s = placePlayer(s, "GK", "a");
    s = benchPlayer(s, "b");
    s = placePlayer(s, slot("LB"), "b");
    s = placePlayer(s, slot("RB"), "a");
    const ids = playerIds(s);
    expect(new Set(ids).size).toBe(ids.length);
    expect(slotOfPlayer(s, "a")).toBe(slot("RB"));
    expect(s.slots.GK).toBeUndefined();
  });

  it("ignores unknown slots", () => {
    const s = emptyLineup("4-4-2");
    expect(placePlayer(s, "NOPE", "a")).toBe(s);
  });

  it("bench and remove work", () => {
    let s = placePlayer(emptyLineup("4-4-2"), "GK", "a");
    s = benchPlayer(s, "a");
    expect(s.slots.GK).toBeUndefined();
    expect(s.bench).toEqual(["a"]);
    s = removePlayer(s, "a");
    expect(playerIds(s)).toEqual([]);
  });

  it("dragging keeps the player inside the pitch and a new occupant resets the spot", () => {
    let s = placePlayer(emptyLineup("4-4-2"), "GK", "a");
    s = movePlayer(s, "GK", 150, -20);
    expect(s.offsets.GK).toEqual({ x: 96, y: 4 });
    s = placePlayer(s, "GK", "b");
    expect(s.offsets.GK).toBeUndefined();
    expect(movePlayer(s, slot("LB"), 10, 10)).toBe(s); // empty slot: nothing to move
  });

  it("changing formation keeps the keeper in goal and defenders in defence", () => {
    let s = emptyLineup("4-4-2");
    s = placePlayer(s, "GK", "gk");
    f.slots.filter((x) => x.role === "DEF").forEach((x, i) => { s = placePlayer(s, x.id, `d${i}`); });
    f.slots.filter((x) => x.role === "FWD").forEach((x, i) => { s = placePlayer(s, x.id, `f${i}`); });
    const next = changeFormation(s, "5-3-2");
    const nf = getFormation("5-3-2")!;
    expect(next.slots.GK).toBe("gk");
    expect(nf.slots.filter((x) => x.role === "DEF").map((x) => next.slots[x.id]).filter(Boolean)).toHaveLength(4);
    expect(nf.slots.filter((x) => x.role === "FWD").map((x) => next.slots[x.id])).toEqual(["f0", "f1"]);
    expect(next.bench).toEqual([]);
  });

  it("players who no longer fit go to the bench, nobody is lost", () => {
    let s = emptyLineup("4-4-2");
    f.slots.filter((x) => x.role === "FWD").forEach((x, i) => { s = placePlayer(s, x.id, `f${i}`); });
    f.slots.filter((x) => x.role === "MID").forEach((x, i) => { s = placePlayer(s, x.id, `m${i}`); });
    const next = changeFormation(s, "5-4-1");
    expect(new Set(playerIds(next))).toEqual(new Set(playerIds(s)));
    expect(startersOf(next).filter((x) => x.slot.role === "FWD")).toHaveLength(1);
    expect(next.bench).toContain("f1");
  });

  it("an unknown formation is ignored", () => {
    const s = placePlayer(emptyLineup("4-4-2"), "GK", "a");
    expect(changeFormation(s, "7-7-7")).toBe(s);
  });

  it("reset keeps the formation but empties everything", () => {
    const s = resetLineup(placePlayer(emptyLineup("3-5-2"), "GK", "a"));
    expect(s.formation).toBe("3-5-2");
    expect(playerIds(s)).toEqual([]);
  });

  it("saves and loads back to the same lineup, including dragged positions and bench order", () => {
    let s = emptyLineup("4-3-3");
    s = placePlayer(s, "GK", "gk");
    s = placePlayer(s, "L0_1", "cb");
    s = movePlayer(s, "L0_1", 40, 66.5);
    s = benchPlayer(s, "sub1");
    s = benchPlayer(s, "sub2");
    const back = fromEntries("4-3-3", toEntries(s));
    expect(back).toEqual(s);
    expect(toEntries(s).filter((e) => e.role === "bench").map((e) => e.playerId)).toEqual(["sub1", "sub2"]);
  });

  it("loading entries that no longer fit the formation puts them on the bench", () => {
    const back = fromEntries("4-4-2", [
      { playerId: "a", role: "starter", slotId: "OLD_SLOT", x: 10, y: 10, sort: 0 },
      { playerId: "b", role: "starter", slotId: "GK", x: 50, y: 90, sort: 0 },
    ]);
    expect(back.slots.GK).toBe("b");
    expect(back.bench).toEqual(["a"]);
  });

  it("duplicating an old lineup drops people who left the squad", () => {
    let s = placePlayer(emptyLineup("4-4-2"), "GK", "gone");
    s = benchPlayer(s, "here");
    const kept = keepOnly(s, new Set(["here"]));
    expect(playerIds(kept)).toEqual(["here"]);
  });
});

describe("validateLineup", () => {
  const ctx = (avail: Record<string, "yes" | "maybe" | "no" | "none">, active = Object.keys(avail)) => ({
    activeIds: new Set(active),
    names: new Map(Object.keys(avail).map((id) => [id, id.toUpperCase()])),
    availability: new Map(Object.entries(avail)) as Map<string, "yes" | "maybe" | "no" | "none">,
  });

  it("a full lineup of available players is clean", () => {
    let s = emptyLineup("4-4-2");
    const avail: Record<string, "yes"> = {};
    getFormation("4-4-2")!.slots.forEach((slot, i) => { s = placePlayer(s, slot.id, `p${i}`); avail[`p${i}`] = "yes"; });
    expect(validateLineup(s, ctx(avail))).toEqual({ errors: [], warnings: [] });
  });

  it("warns about no keeper, an incomplete XI, unavailable and unanswered players", () => {
    let s = emptyLineup("4-4-2");
    s = placePlayer(s, "L0_0", "a");
    s = benchPlayer(s, "b");
    const { errors, warnings } = validateLineup(s, ctx({ a: "no", b: "none" }));
    expect(errors).toEqual([]);
    expect(warnings.map((w) => w.code).sort()).toEqual(["incomplete", "no_goalkeeper", "no_response", "unavailable"]);
  });

  it("errors on players who left the squad", () => {
    const s = placePlayer(emptyLineup("4-4-2"), "GK", "ghost");
    const { errors } = validateLineup(s, ctx({ ghost: "yes" }, []));
    expect(errors.map((e) => e.code)).toEqual(["unknown_player"]);
  });

  it("errors on more than 11 starters or a duplicated player (corrupt state)", () => {
    const s = emptyLineup("4-4-2");
    const corrupt = { ...s, slots: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`S${i}`, `p${i}`])) };
    expect(validateLineup(corrupt, ctx(Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`p${i}`, "yes"])))).errors.map((e) => e.code)).toContain("too_many_starters");
    const dup = { ...s, slots: { GK: "a" }, bench: ["a"] };
    expect(validateLineup(dup, ctx({ a: "yes" })).errors.map((e) => e.code)).toContain("duplicate");
  });
});

describe("placeNearest", () => {
  it("fills the closest empty slot to where the player was dropped", () => {
    const s = emptyLineup("4-4-2");
    const gk = getFormation("4-4-2")!.slots.find((x) => x.role === "GK")!;
    const next = placeNearest(s, "p1", gk.x, gk.y);
    expect(next.slots[gk.id]).toBe("p1");
  });

  it("skips taken slots and uses the next closest empty one", () => {
    let s = emptyLineup("4-4-2");
    const gk = getFormation("4-4-2")!.slots.find((x) => x.role === "GK")!;
    s = placeNearest(s, "p1", gk.x, gk.y);
    const second = placeNearest(s, "p2", gk.x, gk.y);
    expect(second.slots[gk.id]).toBe("p1");
    expect(Object.values(second.slots).sort()).toEqual(["p1", "p2"]);
  });

  it("swaps with the closest player when the formation is full", () => {
    let s = emptyLineup("4-4-2");
    getFormation("4-4-2")!.slots.forEach((slot, i) => { s = placePlayer(s, slot.id, `p${i}`); });
    const gk = getFormation("4-4-2")!.slots.find((x) => x.role === "GK")!;
    const next = placeNearest(s, "sub", gk.x, gk.y);
    expect(next.slots[gk.id]).toBe("sub");
    expect(next.bench).toHaveLength(1);
    expect(Object.keys(next.slots)).toHaveLength(11);
  });
});

import { assign, autoFill, formBonus, positionFit } from "./autofill";
import type { AvailabilityState, SeasonPlayerStat } from "@/types";

describe("positionFit", () => {
  const slot = (role: "GK" | "DEF" | "MID" | "FWD", label: string) => ({ role, label });
  it("rewards the natural position and respects side", () => {
    expect(positionFit(["Left Back"], slot("DEF", "LB"))).toBe(100);
    expect(positionFit(["Left Back"], slot("DEF", "RB"))).toBe(62);
    expect(positionFit(["Striker"], slot("FWD", "ST"))).toBe(100);
  });
  it("counts extra positions a little less than the main one", () => {
    expect(positionFit(["Striker", "Right Winger"], slot("FWD", "RW"))).toBeCloseTo(92);
    expect(positionFit(["Centre Back", "Left Back"], slot("DEF", "LB"))).toBeGreaterThan(positionFit(["Centre Back"], slot("DEF", "LB")));
  });
  it("keeps keepers in goal and outfielders out of it", () => {
    expect(positionFit(["Goalkeeper"], slot("GK", "GK"))).toBe(100);
    expect(positionFit(["Striker"], slot("GK", "GK"))).toBe(0);
    expect(positionFit(["Goalkeeper"], slot("FWD", "ST"))).toBe(0);
  });
  it("is neutral for a player with no position", () => {
    expect(positionFit([], slot("MID", "CM"))).toBe(35);
  });
});

describe("assign (Hungarian)", () => {
  it("finds the cheapest assignment, not just the greedy one", () => {
    // greedy would give row 0 → col 0 (cost 1) then row 1 → col 1 (cost 100); best is 2 + 2.
    expect(assign([[1, 2], [2, 100]])).toEqual([1, 0]);
  });
  it("handles more columns than rows", () => {
    expect(assign([[5, 1, 9], [4, 8, 2]])).toEqual([1, 2]);
  });
});

describe("autoFill", () => {
  const P = (id: string, positions: string[], active = true) => ({ id, name: id, positions, active });
  const squad = [
    P("gk", ["Goalkeeper"]), P("lb", ["Left Back"]), P("cb1", ["Centre Back"]), P("cb2", ["Centre Back"]), P("rb", ["Right Back"]),
    P("lm", ["Left Winger"]), P("cm1", ["Central Midfielder"]), P("cm2", ["Central Midfielder"]), P("rm", ["Right Winger"]),
    P("st1", ["Striker"]), P("st2", ["Striker", "Second Striker"]), P("sub1", ["Striker"]), P("sub2", ["Centre Back"]),
  ];
  const all = (a: AvailabilityState = "yes") => new Map(squad.map((p) => [p.id, a]));
  const base = { players: squad, stats: [] as SeasonPlayerStat[], matchesPlayed: 0 };

  it("fills a 4-4-2 with everyone in their natural spot", () => {
    const r = autoFill(emptyLineup("4-4-2"), { ...base, availability: all() });
    expect(r.filled).toBe(11);
    expect(r.missing).toBe(0);
    expect(r.outOfPosition).toEqual([]);
    expect(r.state.slots["GK"]).toBe("gk");
    expect(Object.values(r.state.slots)).toHaveLength(11);
    expect(r.state.bench.sort()).toEqual(["sub1", "sub2"]);
  });

  it("fills the bench with confirmed players first, then maybe, then unanswered", () => {
    const a = all();
    a.set("sub1", "none"); a.set("sub2", "maybe"); a.set("st2", "yes");
    const r = autoFill(emptyLineup("4-4-2"), { ...base, availability: a, benchSize: 1 });
    expect(r.state.bench).toHaveLength(1);
    // both st2 and sub2/sub1 compete for the last spots; whoever is left over and confirmed must rank above maybe/none
    const left = squad.map((p) => p.id).filter((id) => !Object.values(r.state.slots).includes(id));
    const order = ["yes", "maybe", "none"];
    const best = left.sort((x, y) => order.indexOf(a.get(x)!) - order.indexOf(a.get(y)!))[0];
    expect(r.state.bench[0]).toBe(best);
  });

  it("never picks anyone who said no, and prefers yes over maybe", () => {
    const a = all();
    a.set("gk", "no"); a.set("st1", "maybe");
    const r = autoFill(emptyLineup("4-4-2"), { ...base, availability: a });
    expect(Object.values(r.state.slots)).not.toContain("gk");
    // Nobody else is a keeper: someone still has to go in goal, and the result says so.
    expect(r.state.slots["GK"]).toBeDefined();
    expect(r.outOfPosition.map((o) => o.slotLabel)).toContain("GK");
  });

  it("leaves spots empty when too few players are available", () => {
    const a = new Map(squad.map((p, i) => [p.id, i < 5 ? "yes" : "no"] as [string, AvailabilityState]));
    const r = autoFill(emptyLineup("4-4-2"), { ...base, availability: a });
    expect(r.filled).toBe(5);
    expect(r.missing).toBe(6);
  });

  it("keeps players the coach already placed", () => {
    const start = placePlayer(emptyLineup("4-4-2"), "L2_0", "st2");
    const r = autoFill(start, { ...base, availability: all() });
    expect(r.state.slots["L2_0"]).toBe("st2");
    expect(r.filled).toBe(10);
    expect(new Set(Object.values(r.state.slots)).size).toBe(11);
  });

  it("uses goals and assists to choose between two equal strikers", () => {
    const stats: SeasonPlayerStat[] = [
      { playerId: "st1", appearances: 10, starts: 10, subAppearances: 0, minutes: 900, goals: 2, assists: 0, yellow: 0, red: 0, ownGoals: 0, wins: 0, draws: 0, losses: 0 },
      { playerId: "sub1", appearances: 10, starts: 10, subAppearances: 0, minutes: 900, goals: 14, assists: 3, yellow: 0, red: 0, ownGoals: 0, wins: 0, draws: 0, losses: 0 },
    ];
    const r = autoFill(emptyLineup("4-4-2"), { players: squad.filter((p) => p.id !== "st2"), availability: all(), stats, matchesPlayed: 10 });
    const strikers = ["L2_0", "L2_1"].map((k) => r.state.slots[k]);
    expect(strikers).toContain("sub1");
    expect(formBonus(stats[1], "FWD")).toBeGreaterThan(formBonus(stats[0], "FWD"));
  });

  it("reports players put out of position", () => {
    // Both striker spots already hold the coach's picks, so the only free player must fill a defensive spot.
    let start = placePlayer(emptyLineup("4-4-2"), "L2_0", "x1");
    start = placePlayer(start, "L2_1", "x2");
    const r = autoFill(start, { players: [P("a", ["Striker"])], availability: new Map([["a", "yes"]]), stats: [], matchesPlayed: 0 });
    expect(r.filled).toBe(1);
    expect(r.outOfPosition.map((o) => o.playerId)).toEqual(["a"]);
  });
});
