import { supabase } from "@/lib/supabase/client";
import { unwrap } from "./util";
import type { SeasonPlayerStat } from "@/types";

interface StatRow {
  player_id: string; appearances: number; starts: number; sub_appearances: number; minutes: number; goals: number;
  assists: number; yellow: number; red: number; own_goals: number; wins: number; draws: number; losses: number;
}

export async function fetchSeasonStats(teamId: string, seasonId: string): Promise<SeasonPlayerStat[]> {
  const rows = unwrap(await supabase().from("season_player_stats").select("*")
    .eq("team_id", teamId).eq("season_id", seasonId)) as StatRow[];
  return rows.map((r) => ({
    playerId: r.player_id, appearances: r.appearances, starts: r.starts, subAppearances: r.sub_appearances,
    minutes: r.minutes, goals: r.goals, assists: r.assists, yellow: r.yellow, red: r.red, ownGoals: r.own_goals,
    wins: r.wins, draws: r.draws, losses: r.losses,
  }));
}

/** Sessions held so far this season, and how many each player attended. */
export async function fetchTrainingAttendance(teamId: string, seasonId: string): Promise<{ held: number; attended: Map<string, number> }> {
  const held = await supabase().from("trainings").select("id", { count: "exact", head: true })
    .eq("team_id", teamId).eq("season_id", seasonId).lt("starts_at", new Date().toISOString());
  if (held.error) throw held.error;
  const rows = unwrap(await supabase().from("season_training_attendance").select("player_id, attended")
    .eq("team_id", teamId).eq("season_id", seasonId)) as { player_id: string; attended: number }[];
  return { held: held.count ?? 0, attended: new Map(rows.map((r) => [r.player_id, r.attended])) };
}
