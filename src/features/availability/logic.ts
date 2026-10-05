import type { AvailabilityState, AvailabilityStatus, EventKind } from "@/types";

export interface RosterEntry { id: string; name: string; number?: number | null }

export interface AvailabilityRow { player: RosterEntry; status: AvailabilityState }

export interface AvailabilitySummary {
  yes: AvailabilityRow[];
  maybe: AvailabilityRow[];
  no: AvailabilityRow[];
  none: AvailabilityRow[];
  total: number;
  responded: number;
}

/** Join the roster with responses. Every roster player gets exactly one row. */
export function buildRows(
  roster: RosterEntry[],
  responses: { playerId: string; status: AvailabilityStatus | null }[],
): AvailabilityRow[] {
  const byPlayer = new Map<string, AvailabilityStatus>();
  for (const r of responses) if (r.status) byPlayer.set(r.playerId, r.status);
  return roster.map((player) => ({ player, status: byPlayer.get(player.id) ?? "none" }));
}

export function summarize(rows: AvailabilityRow[]): AvailabilitySummary {
  const pick = (s: AvailabilityState) => rows.filter((r) => r.status === s);
  const none = pick("none");
  return {
    yes: pick("yes"), maybe: pick("maybe"), no: pick("no"), none,
    total: rows.length, responded: rows.length - none.length,
  };
}

export function formatKickoff(date: Date, locale = "en-GB"): string {
  const day = date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  const time = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day}, ${time}`;
}

const ASK: Record<EventKind, string> = {
  match: "Can you play? Tap your name (10 seconds):",
  training: "Are you coming? Tap your name (10 seconds):",
};

/** Text the coach pastes into WhatsApp/Viber when asking for availability. */
export function buildInviteText(opts: { kind: EventKind; title: string; date: Date; place: string; url: string }): string {
  return [
    `⚽ ${opts.title}`,
    `📅 ${formatKickoff(opts.date)}`,
    opts.place ? `📍 ${opts.place}` : "",
    "",
    ASK[opts.kind],
    opts.url,
  ].filter((line, i, all) => line !== "" || (i > 0 && all[i - 1] !== "")).join("\n");
}

/** Reminder addressed to the players who have not answered yet. */
export function buildReminderText(opts: { title: string; date: Date; url: string; missing: RosterEntry[] }): string {
  const names = opts.missing.map((p) => p.name).join(", ");
  return [
    `⏰ Reminder: ${opts.title} — ${formatKickoff(opts.date)}`,
    names ? `Still waiting for: ${names}` : "",
    "",
    "Please tap your name and answer:",
    opts.url,
  ].filter((line, i, all) => line !== "" || (i > 0 && all[i - 1] !== "")).join("\n");
}

export function buildShareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/a/${token}`;
}
