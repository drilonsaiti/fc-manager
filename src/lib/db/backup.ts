import { supabase } from "@/lib/supabase/client";
import { unwrap } from "./util";

const TABLES = [
  "seasons", "players", "matches", "lineups", "lineup_entries", "match_events",
  "match_responses", "player_match_stats", "trainings", "training_responses",
] as const;

/** Everything the team owns, as plain JSON. The free Supabase plan has no automatic backups. */
export async function exportTeam(teamId: string): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), teamId };
  const team = unwrap(await supabase().from("teams").select("id, name, created_at").eq("id", teamId)) as unknown[];
  out.team = team[0] ?? null;
  for (const t of TABLES) {
    out[t] = unwrap(await supabase().from(t).select("*").eq("team_id", teamId));
  }
  return out;
}
