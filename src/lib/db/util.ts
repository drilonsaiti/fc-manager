import type { PostgrestError } from "@supabase/supabase-js";

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

/** A short message a coach can act on. Falls back to a generic one; never leaks SQL. */
export function friendlyError(e: unknown, fallback = "Something went wrong. Please try again."): string {
  const code = (e as { code?: string } | null)?.code;
  const msg = e instanceof Error ? e.message : "";
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return "No connection. Check your internet and try again.";
  if (code === "42501" || /row-level security|permission denied|not allowed/i.test(msg)) return "You don't have permission to do that.";
  if (code === "23505") return "That already exists.";
  if (code === "23503") return "That is still in use, so it can't be removed. Archive it instead.";
  if (code === "23514") return "Those details aren't valid.";
  if (/invalid or expired code/i.test(msg)) return "That invite code is invalid or has expired.";
  if (/too many attempts|team limit/i.test(msg)) return "Too many attempts. Please wait a while and try again.";
  if (/Invalid login credentials/i.test(msg)) return "Wrong email or password.";
  if (/already registered|User already/i.test(msg)) return "An account with this email already exists.";
  if (/Password should be at least/i.test(msg)) return "Password must be at least 6 characters.";
  if (/Email not confirmed/i.test(msg)) return "Please confirm your email first (or ask the owner to disable email confirmation).";
  return fallback;
}
