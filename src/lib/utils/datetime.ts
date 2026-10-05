import { getLocale } from "@/i18n";

const pad = (n: number) => String(n).padStart(2, "0");

/** Value for <input type="datetime-local"> in the user's own time zone. */
export function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(v: string): Date | null {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Next Saturday-or-later default: tomorrow at 10:00. */
export function defaultKickoff(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

export function shortDate(d: Date, locale = getLocale()): string {
  return d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" }) +
    " · " + d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
}
