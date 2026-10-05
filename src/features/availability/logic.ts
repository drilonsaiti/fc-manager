import { formatDay, formatTime } from "@/i18n/dates";
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
  return `${formatDay(date, locale, { weekday: "long", month: "long" })}, ${formatTime(date)}`;
}

export interface MessageLabels {
  askMatch: string;
  askTraining: string;
  /** Uses {title} and {when}. */
  reminder: string;
  /** Uses {names}. */
  waiting: string;
  pleaseAnswer: string;
}

export const EN_LABELS: MessageLabels = {
  askMatch: "Can you play? Tap your name (10 seconds):",
  askTraining: "Are you coming? Tap your name (10 seconds):",
  reminder: "⏰ Reminder: {title} — {when}",
  waiting: "Still waiting for: {names}",
  pleaseAnswer: "Please tap your name and answer:",
};

const put = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
const tidy = (lines: string[]) => lines.filter((line, i, all) => line !== "" || (i > 0 && all[i - 1] !== ""));

/** Text the coach pastes into WhatsApp/Viber when asking for availability. */
export function buildInviteText(opts: {
  kind: EventKind; title: string; date: Date; place: string; url: string; labels?: MessageLabels; locale?: string;
}): string {
  const l = opts.labels ?? EN_LABELS;
  return tidy([
    `⚽ ${opts.title}`,
    `📅 ${formatKickoff(opts.date, opts.locale)}`,
    opts.place ? `📍 ${opts.place}` : "",
    "",
    opts.kind === "match" ? l.askMatch : l.askTraining,
    opts.url,
  ]).join("\n");
}

/** Reminder addressed to the players who have not answered yet. */
export function buildReminderText(opts: {
  title: string; date: Date; url: string; missing: RosterEntry[]; labels?: MessageLabels; locale?: string;
}): string {
  const l = opts.labels ?? EN_LABELS;
  const names = opts.missing.map((p) => p.name).join(", ");
  return tidy([
    put(l.reminder, { title: opts.title, when: formatKickoff(opts.date, opts.locale) }),
    names ? put(l.waiting, { names }) : "",
    "",
    l.pleaseAnswer,
    opts.url,
  ]).join("\n");
}

/**
 * The public page gets an English title from the database ("vs Rivals", "Training · match practice").
 * Rebuild it in the viewer's language.
 */
export function publicHeading(
  event: { kind: EventKind; title: string },
  words: { vs: string; training: string; kinds: Record<string, string> },
): string {
  if (event.kind === "match") return `${words.vs} ${event.title.replace(/^vs /, "")}`;
  const kind = event.title.split(" · ")[1];
  const label = kind ? words.kinds[kind.replace(/ /g, "_")] : undefined;
  return label ? `${words.training} · ${label}` : words.training;
}

export function buildShareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/a/${token}`;
}

/** The event link that already knows who is tapping. Works on any phone or network. */
export function buildPersonalUrl(origin: string, token: string, code: string): string {
  return `${buildShareUrl(origin, token)}?p=${code}`;
}

/** One line per player: "Name: link". The coach sends each person their own line. */
export function buildPersonalLinksText(opts: {
  title: string; date: Date; entries: { name: string; url: string }[]; locale?: string;
}): string {
  return [`⚽ ${opts.title} — ${formatKickoff(opts.date, opts.locale)}`, "", ...opts.entries.map((e) => `${e.name}: ${e.url}`)].join("\n");
}

/** WhatsApp deep link with a prefilled message; null when the phone number has no digits. */
export function whatsappUrl(phone: string | null, text: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "").replace(/^00/, "");
  return digits.length >= 6 ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}
