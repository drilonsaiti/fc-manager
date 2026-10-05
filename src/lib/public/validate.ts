import { createHash } from "node:crypto";

export const MIN_ELAPSED_MS = 600;
const MAX_ELAPSED_MS = 7 * 24 * 3600 * 1000;
const TOKEN = /^[a-f0-9]{32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ["yes", "maybe", "no"] as const;

export type Status = (typeof STATUSES)[number];

export type Verdict =
  | { kind: "ok"; token: string; playerId: string; status: Status }
  | { kind: "bot" }
  | { kind: "invalid"; reason: "token" | "body" | "player" | "status" };

export const isToken = (t: string) => TOKEN.test(t);

/**
 * Cheap, layered checks that run before the database is touched.
 *  - "invalid": malformed request → 400.
 *  - "bot": honeypot filled, or answered faster than a human can tap → we pretend it worked
 *    (200) so the sender learns nothing, and we write nothing.
 * The real protection is the unguessable token, the roster check and the rate limits in the
 * database function; these checks just remove the laziest automated traffic.
 */
export function validateSubmission(token: string, body: unknown): Verdict {
  if (!isToken(token)) return { kind: "invalid", reason: "token" };
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { kind: "invalid", reason: "body" };
  const b = body as Record<string, unknown>;

  if (typeof b.playerId !== "string" || !UUID.test(b.playerId)) return { kind: "invalid", reason: "player" };
  if (typeof b.status !== "string" || !(STATUSES as readonly string[]).includes(b.status)) return { kind: "invalid", reason: "status" };

  // Honeypot: a field real people never see or fill.
  if (typeof b.website === "string" && b.website.trim() !== "") return { kind: "bot" };
  if (b.website !== undefined && typeof b.website !== "string") return { kind: "bot" };

  // Time trap: measured from when the page appeared to the tap.
  const elapsed = b.elapsedMs;
  if (typeof elapsed !== "number" || !Number.isFinite(elapsed) || elapsed < MIN_ELAPSED_MS || elapsed > MAX_ELAPSED_MS) {
    return { kind: "bot" };
  }

  return { kind: "ok", token, playerId: b.playerId.toLowerCase(), status: b.status as Status };
}

/** Same-site requests only. A missing Origin (curl, some native clients) is allowed; a foreign one is not. */
export function originAllowed(origin: string | null, host: string | null): boolean {
  if (!origin) return true;
  if (!host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

/** Stable per-visitor key for rate limiting. The IP is hashed with a secret salt and never stored. */
export function visitorKey(ip: string | null, salt: string): string {
  return createHash("sha256").update(`${salt}|${ip ?? "unknown"}`).digest("hex").slice(0, 32);
}

/** First address from x-forwarded-for, else x-real-ip. */
export function clientIp(headers: { get(name: string): string | null }): string | null {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || null;
  return headers.get("x-real-ip");
}
