import { supabase } from "@/lib/supabase/client";
import { check, unwrap } from "./util";
import type { Lineup, LineupEntry, LineupRole } from "@/types";

interface EntryRow {
  player_id: string; role: LineupRole; slot_id: string | null; x: number | string | null; y: number | string | null; sort: number;
}

export async function getLineup(matchId: string): Promise<Lineup | null> {
  const head = unwrap(await supabase().from("lineups").select("formation").eq("match_id", matchId).limit(1)) as { formation: string }[];
  if (!head[0]) return null;
  const rows = unwrap(await supabase().from("lineup_entries").select("player_id, role, slot_id, x, y, sort")
    .eq("match_id", matchId)) as EntryRow[];
  const entries: LineupEntry[] = rows.map((r) => ({
    playerId: r.player_id, role: r.role, slotId: r.slot_id,
    x: r.x == null ? null : Number(r.x), y: r.y == null ? null : Number(r.y), sort: r.sort,
  }));
  return { matchId, formation: head[0].formation, entries };
}

export async function saveLineup(matchId: string, formation: string, entries: LineupEntry[]): Promise<void> {
  check(await supabase().rpc("save_lineup", {
    p_match: matchId,
    p_formation: formation,
    p_entries: entries.map((e) => ({ player_id: e.playerId, role: e.role, slot_id: e.slotId, x: e.x, y: e.y, sort: e.sort })),
  }));
}

export interface LineupSource { matchId: string; opponent: string; kickoff: Date; formation: string }

/** Earlier matches that have a saved lineup, for "duplicate a previous lineup". */
export async function listLineupSources(teamId: string, excludeMatchId: string): Promise<LineupSource[]> {
  const heads = unwrap(await supabase().from("lineups").select("match_id, formation")
    .eq("team_id", teamId).neq("match_id", excludeMatchId)) as { match_id: string; formation: string }[];
  if (heads.length === 0) return [];
  const matches = unwrap(await supabase().from("matches").select("id, opponent, kickoff")
    .in("id", heads.map((h) => h.match_id)).order("kickoff", { ascending: false }).limit(10)) as { id: string; opponent: string; kickoff: string }[];
  const formation = new Map(heads.map((h) => [h.match_id, h.formation]));
  return matches.map((m) => ({ matchId: m.id, opponent: m.opponent, kickoff: new Date(m.kickoff), formation: formation.get(m.id) ?? "4-4-2" }));
}
