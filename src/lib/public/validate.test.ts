import { describe, expect, it } from "vitest";
import { MIN_ELAPSED_MS, clientIp, isToken, originAllowed, validateSubmission, visitorKey } from "./validate";

const token = "a".repeat(32);
const player = "11111111-1111-4111-8111-111111111111";
const good = { playerId: player, status: "yes", website: "", elapsedMs: 4200 };

describe("validateSubmission", () => {
  it("accepts a normal answer", () => {
    expect(validateSubmission(token, good)).toEqual({ kind: "ok", token, playerId: player, status: "yes" });
  });
  it("normalises the player id to lower case", () => {
    const v = validateSubmission(token, { ...good, playerId: player.toUpperCase() });
    expect(v).toMatchObject({ kind: "ok", playerId: player });
  });
  it("rejects malformed tokens, bodies, players and statuses", () => {
    expect(validateSubmission("short", good)).toEqual({ kind: "invalid", reason: "token" });
    expect(validateSubmission("G".repeat(32), good)).toEqual({ kind: "invalid", reason: "token" });
    expect(validateSubmission(token, null)).toEqual({ kind: "invalid", reason: "body" });
    expect(validateSubmission(token, [good])).toEqual({ kind: "invalid", reason: "body" });
    expect(validateSubmission(token, { ...good, playerId: "1; drop table" })).toEqual({ kind: "invalid", reason: "player" });
    expect(validateSubmission(token, { ...good, status: "definitely" })).toEqual({ kind: "invalid", reason: "status" });
    expect(validateSubmission(token, { ...good, status: undefined })).toEqual({ kind: "invalid", reason: "status" });
  });
  it("treats a filled honeypot as a bot", () => {
    expect(validateSubmission(token, { ...good, website: "http://spam.example" })).toEqual({ kind: "bot" });
    expect(validateSubmission(token, { ...good, website: 1 })).toEqual({ kind: "bot" });
    expect(validateSubmission(token, { ...good, website: "   " })).toMatchObject({ kind: "ok" });
  });
  it("treats an impossibly fast or missing fill time as a bot", () => {
    expect(validateSubmission(token, { ...good, elapsedMs: MIN_ELAPSED_MS - 1 })).toEqual({ kind: "bot" });
    expect(validateSubmission(token, { ...good, elapsedMs: 0 })).toEqual({ kind: "bot" });
    expect(validateSubmission(token, { ...good, elapsedMs: -5 })).toEqual({ kind: "bot" });
    expect(validateSubmission(token, { ...good, elapsedMs: "1000" })).toEqual({ kind: "bot" });
    expect(validateSubmission(token, { ...good, elapsedMs: Number.NaN })).toEqual({ kind: "bot" });
    expect(validateSubmission(token, { ...good, elapsedMs: undefined })).toEqual({ kind: "bot" });
    expect(validateSubmission(token, { ...good, elapsedMs: MIN_ELAPSED_MS })).toMatchObject({ kind: "ok" });
  });
  it("shape errors win over bot detection (so a bot cannot probe with garbage)", () => {
    expect(validateSubmission(token, { playerId: "x", status: "yes", website: "spam", elapsedMs: 1 })).toEqual({ kind: "invalid", reason: "player" });
  });
});

describe("isToken", () => {
  it("is exactly 32 lowercase hex characters", () => {
    expect(isToken("0123456789abcdef0123456789abcdef")).toBe(true);
    expect(isToken("0123456789ABCDEF0123456789ABCDEF")).toBe(false);
    expect(isToken("0123456789abcdef0123456789abcde")).toBe(false);
  });
});

describe("originAllowed", () => {
  it("allows same host, no origin; blocks other sites", () => {
    expect(originAllowed("https://club.example", "club.example")).toBe(true);
    expect(originAllowed(null, "club.example")).toBe(true);
    expect(originAllowed("https://evil.example", "club.example")).toBe(false);
    expect(originAllowed("not a url", "club.example")).toBe(false);
    expect(originAllowed("https://club.example", null)).toBe(false);
  });
});

describe("visitorKey", () => {
  it("is stable, salted, and never contains the IP", () => {
    const a = visitorKey("203.0.113.9", "salt1");
    expect(a).toBe(visitorKey("203.0.113.9", "salt1"));
    expect(a).not.toBe(visitorKey("203.0.113.9", "salt2"));
    expect(a).not.toBe(visitorKey("203.0.113.10", "salt1"));
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toContain("203");
  });
});

describe("clientIp", () => {
  const h = (m: Record<string, string>) => ({ get: (k: string) => m[k] ?? null });
  it("prefers the first forwarded address", () => {
    expect(clientIp(h({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(h({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
    expect(clientIp(h({}))).toBeNull();
  });
});
