import { supabase } from "@/lib/supabase/client";

export type ChallengeAction = Record<string, string | boolean | null> & { action: string };

export async function challengeApi(body: ChallengeAction): Promise<unknown> {
  const { data: { session } } = await supabase().auth.getSession();
  if (!session) throw new Error("Sign in required");
  const response = await fetch("/api/challenges", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  });
  const result = await response.json() as { error?: string; data?: unknown };
  if (!response.ok) throw new Error(result.error ?? "Request failed");
  return result.data;
}

export async function loadChallengeInbox(teamId: string): Promise<unknown> {
  const { data: { session } } = await supabase().auth.getSession();
  if (!session) throw new Error("Sign in required");
  const response = await fetch(`/api/challenges?team=${encodeURIComponent(teamId)}`, {
    headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store",
  });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Request failed");
  return result;
}
