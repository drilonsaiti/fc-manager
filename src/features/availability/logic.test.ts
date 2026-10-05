import { describe, expect, it } from "vitest";
import {
  buildInviteText,
  buildReminderText,
  buildRows,
  buildShareUrl,
  summarize,
} from "./logic";

const roster = [
  { id: "a", name: "Ardit", number: 7 },
  { id: "b", name: "Besnik", number: 10 },
  { id: "c", name: "Ermal", number: null },
  { id: "d", name: "Marko" },
  { id: "e", name: "Luan" },
];

describe("buildRows", () => {
  it("gives every roster player exactly one row, defaulting to none", () => {
    const rows = buildRows(roster, [{ playerId: "a", status: "yes" }]);
    expect(rows).toHaveLength(5);
    expect(rows.find((r) => r.player.id === "a")?.status).toBe("yes");
    expect(rows.filter((r) => r.status === "none")).toHaveLength(4);
  });

  it("ignores responses from players that are not on the roster", () => {
    const rows = buildRows(roster, [{ playerId: "ghost", status: "yes" }]);
    expect(rows.every((r) => r.status === "none")).toBe(true);
    expect(rows).toHaveLength(5);
  });
});

describe("summarize", () => {
  it("counts all four states and they add up to the roster", () => {
    const rows = buildRows(roster, [
      { playerId: "a", status: "yes" },
      { playerId: "b", status: "yes" },
      { playerId: "c", status: "maybe" },
      { playerId: "d", status: "no" },
    ]);
    const s = summarize(rows);
    expect([s.yes.length, s.maybe.length, s.no.length, s.none.length]).toEqual([2, 1, 1, 1]);
    expect(s.total).toBe(5);
    expect(s.responded).toBe(4);
    expect(s.yes.length + s.maybe.length + s.no.length + s.none.length).toBe(s.total);
  });

  it("handles an empty roster", () => {
    const s = summarize([]);
    expect(s.total).toBe(0);
    expect(s.responded).toBe(0);
  });
});

describe("messages", () => {
  const date = new Date(2026, 9, 11, 15, 0);
  const url = "https://x.test/a/tok";

  it("invite contains title, place and link", () => {
    const t = buildInviteText({ kind: "match", title: "vs Rivals", date, place: "Main pitch", url });
    expect(t).toContain("vs Rivals");
    expect(t).toContain("Main pitch");
    expect(t).toContain(url);
    expect(t).toContain("15:00");
  });

  it("training invite asks differently and tolerates a missing place", () => {
    const t = buildInviteText({ kind: "training", title: "Training", date, place: "", url });
    expect(t).toContain("Are you coming?");
    expect(t).not.toContain("📍");
  });

  it("reminder names only the missing players", () => {
    const t = buildReminderText({ title: "vs Rivals", date, url, missing: [roster[3], roster[4]] });
    expect(t).toContain("Marko, Luan");
    expect(t).not.toContain("Ardit");
    expect(t).toContain(url);
  });

  it("reminder without missing names has no empty 'waiting for' line", () => {
    const t = buildReminderText({ title: "vs Rivals", date, url, missing: [] });
    expect(t).not.toContain("Still waiting");
  });

  it("share url has no double slash", () => {
    expect(buildShareUrl("https://x.test/", "tok")).toBe("https://x.test/a/tok");
  });
});

import { buildPersonalLinksText, buildPersonalUrl, whatsappUrl } from "./logic";

describe("personal links", () => {
  it("adds the player's code to the event link", () => {
    expect(buildPersonalUrl("https://x.app/", "tok", "abc")).toBe("https://x.app/a/tok?p=abc");
  });
  it("lists one line per player", () => {
    const text = buildPersonalLinksText({ title: "vs Rivals", date: new Date("2026-10-10T16:00:00"), entries: [{ name: "Ardit", url: "u1" }, { name: "Besnik", url: "u2" }] });
    expect(text.split("\n").slice(-2)).toEqual(["Ardit: u1", "Besnik: u2"]);
  });
  it("builds a WhatsApp link only for a usable number", () => {
    expect(whatsappUrl("+389 70 123 456", "hi there")).toBe("https://wa.me/38970123456?text=hi%20there");
    expect(whatsappUrl("0038970123456", "x")).toContain("wa.me/38970123456");
    expect(whatsappUrl("12", "x")).toBeNull();
    expect(whatsappUrl(null, "x")).toBeNull();
  });
});
