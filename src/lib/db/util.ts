import type { PostgrestError } from "@supabase/supabase-js";
import { tr } from "@/i18n";

export class DbError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export function unwrap<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw new DbError(res.error.message, res.error.code);
  return res.data as T;
}

export function check(res: { error: PostgrestError | null }): void {
  if (res.error) throw new DbError(res.error.message, res.error.code);
}

export const toDate = (v: string): Date => new Date(v);
export const toDateOrNull = (v: string | null): Date | null => (v ? new Date(v) : null);

/** A short message a coach can act on, in the current language. Never leaks SQL. */
export function friendlyError(e: unknown, fallback?: string): string {
  const code = (e as { code?: string } | null)?.code;
  const msg = e instanceof Error ? e.message : "";
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return tr("err.network");
  if (code === "42501" || /row-level security|permission denied|not allowed/i.test(msg)) return tr("err.permission");
  if (code === "23505") return tr("err.exists");
  if (code === "23503") return tr("err.inUse");
  if (code === "23514") return tr("err.invalid");
  if (/invalid or expired code/i.test(msg)) return tr("err.badCode");
  if (/too many attempts|team limit/i.test(msg)) return tr("err.tooMany");
  if (/Invalid login credentials/i.test(msg)) return tr("err.badLogin");
  if (/already registered|User already/i.test(msg)) return tr("err.emailTaken");
  if (/Password should be at least/i.test(msg)) return tr("err.shortPassword");
  if (/Email not confirmed/i.test(msg)) return tr("err.emailNotConfirmed");
  return fallback ?? tr("err.generic");
}
