import { supabase } from "@/lib/supabase/client";
import { check, toDate, unwrap } from "./util";
import type { EventType, MatchEvent, PlayerMatchStat, Side } from "@/types";

interface EventRow {
  id: string; match_id: string; type: EventType; side: Side; minute: number;
  player_id: string | null; related_player_id: string | null; created_at: string;
}

export async function listEvents(matchId: string): Promise<MatchEvent[]> {
  const rows = unwrap(await supabase().from("match_events")
    .select("id, match_id, type, side, minute, player_id, related_player_id, created_at")
    .eq("match_id", matchId).order("minute").order("created_at")) as EventRow[];
  return rows.map((r) => ({
    id: r.id, matchId: r.match_id, type: r.type, side: r.side, minute: r.minute,
    playerId: r.player_id, relatedPlayerId: r.related_player_id, createdAt: toDate(r.created_at),
  }));
}

export interface EventInput {
  type: EventType;
  side: Side;
  minute: number;
  playerId: string | null;
  relatedPlayerId: string | null;
}

export async function addEvent(matchId: string, teamId: string, e: EventInput): Promise<void> {
  check(await supabase().from("match_events").insert({
    match_id: matchId, team_id: teamId, type: e.type, side: e.side, minute: e.minute,
    player_id: e.playerId, related_player_id: e.relatedPlayerId,
  }));
}

export async function deleteEvent(id: string): Promise<void> {
  check(await supabase().from("match_events").delete().eq("id", id));
}

export async function finishMatch(matchId: string, ours: number, theirs: number, stats: PlayerMatchStat[]): Promise<void> {
  check(await supabase().rpc("finish_match", {
    p_match: matchId, p_our: ours, p_their: theirs,
    p_stats: stats.map((s) => ({
      player_id: s.playerId, started: s.started, minutes: s.minutes, goals: s.goals,
      assists: s.assists, yellow: s.yellow, red: s.red, own_goals: s.ownGoals,
    })),
  }));
}

export async function reopenMatch(matchId: string): Promise<void> {
  check(await supabase().rpc("reopen_match", { p_match: matchId }));
}
