import { supabase } from "@/lib/supabase/client";
import { check, toDate, toDateOrNull, unwrap } from "./util";
import type { Competition, Match, MatchStatus } from "@/types";

interface MatchRow {
  id: string; team_id: string; season_id: string | null; opponent: string; kickoff: string; venue: string;
  competition: Competition; is_home: boolean; status: MatchStatus; duration_minutes: number;
  started_at: string | null; our_score: number | null; their_score: number | null; notes: string | null;
  share_token: string; responses_open: boolean;
}

const COLUMNS = "id, team_id, season_id, opponent, kickoff, venue, competition, is_home, status, duration_minutes, started_at, our_score, their_score, notes, share_token, responses_open";

export const toMatch = (r: MatchRow): Match => ({
  id: r.id, teamId: r.team_id, seasonId: r.season_id, opponent: r.opponent, kickoff: toDate(r.kickoff),
  venue: r.venue, competition: r.competition, isHome: r.is_home, status: r.status,
  durationMinutes: r.duration_minutes, startedAt: toDateOrNull(r.started_at),
  ourScore: r.our_score, theirScore: r.their_score, notes: r.notes,
  shareToken: r.share_token, responsesOpen: r.responses_open,
});

/** Matches of one season (or every season when seasonId is null), newest first. */
export async function listMatches(teamId: string, seasonId: string | null): Promise<Match[]> {
  let q = supabase().from("matches").select(COLUMNS).eq("team_id", teamId);
  if (seasonId) q = q.eq("season_id", seasonId);
  const rows = unwrap(await q.order("kickoff", { ascending: false })) as MatchRow[];
  return rows.map(toMatch);
}

export async function getMatch(id: string): Promise<Match | null> {
  const rows = unwrap(await supabase().from("matches").select(COLUMNS).eq("id", id).limit(1)) as MatchRow[];
  return rows[0] ? toMatch(rows[0]) : null;
}

export interface MatchInput {
  opponent: string;
  kickoff: Date;
  venue: string;
  competition: Competition;
  isHome: boolean;
  durationMinutes: number;
  notes: string | null;
}

const toRow = (i: MatchInput) => ({
  opponent: i.opponent.trim(), kickoff: i.kickoff.toISOString(), venue: i.venue.trim(),
  competition: i.competition, is_home: i.isHome, duration_minutes: i.durationMinutes, notes: i.notes?.trim() || null,
});

export async function createMatch(teamId: string, seasonId: string | null, input: MatchInput): Promise<string> {
  const rows = unwrap(await supabase().from("matches").insert({ team_id: teamId, season_id: seasonId, ...toRow(input) })
    .select("id")) as { id: string }[];
  return rows[0].id;
}

export async function updateMatch(id: string, input: MatchInput): Promise<void> {
  check(await supabase().from("matches").update(toRow(input)).eq("id", id));
}

export async function deleteMatch(id: string): Promise<void> {
  check(await supabase().from("matches").delete().eq("id", id));
}

export async function setMatchStatus(id: string, status: "scheduled" | "cancelled"): Promise<void> {
  check(await supabase().from("matches").update({ status }).eq("id", id));
}

export async function setResponsesOpen(id: string, open: boolean): Promise<void> {
  check(await supabase().from("matches").update({ responses_open: open }).eq("id", id));
}

/** Kick-off: the match goes live and the matchday clock starts now. */
export async function startMatch(id: string): Promise<void> {
  check(await supabase().from("matches").update({ status: "live", started_at: new Date().toISOString() }).eq("id", id));
}

export async function setMatchNotes(id: string, notes: string): Promise<void> {
  check(await supabase().from("matches").update({ notes: notes.trim() || null }).eq("id", id));
}
