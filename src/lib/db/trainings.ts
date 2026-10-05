import { supabase } from "@/lib/supabase/client";
import { check, toDate, unwrap } from "./util";
import type { Training, TrainingKind } from "@/types";

interface TrainingRow {
  id: string; team_id: string; season_id: string | null; starts_at: string; location: string;
  kind: TrainingKind | null; notes: string | null; share_token: string; responses_open: boolean;
}

const COLUMNS = "id, team_id, season_id, starts_at, location, kind, notes, share_token, responses_open";

const toTraining = (r: TrainingRow): Training => ({
  id: r.id, teamId: r.team_id, seasonId: r.season_id, startsAt: toDate(r.starts_at), location: r.location,
  kind: r.kind, notes: r.notes, shareToken: r.share_token, responsesOpen: r.responses_open,
});

export async function listTrainings(teamId: string, seasonId: string | null): Promise<Training[]> {
  let q = supabase().from("trainings").select(COLUMNS).eq("team_id", teamId);
  if (seasonId) q = q.eq("season_id", seasonId);
  const rows = unwrap(await q.order("starts_at", { ascending: false })) as TrainingRow[];
  return rows.map(toTraining);
}

export interface TrainingInput { startsAt: Date; location: string; kind: TrainingKind | null; notes: string | null }

const toRow = (i: TrainingInput) => ({
  starts_at: i.startsAt.toISOString(), location: i.location.trim(), kind: i.kind, notes: i.notes?.trim() || null,
});

export async function createTraining(teamId: string, seasonId: string | null, input: TrainingInput): Promise<void> {
  check(await supabase().from("trainings").insert({ team_id: teamId, season_id: seasonId, ...toRow(input) }));
}

export async function updateTraining(id: string, input: TrainingInput): Promise<void> {
  check(await supabase().from("trainings").update(toRow(input)).eq("id", id));
}

export async function deleteTraining(id: string): Promise<void> {
  check(await supabase().from("trainings").delete().eq("id", id));
}

export async function setTrainingResponsesOpen(id: string, open: boolean): Promise<void> {
  check(await supabase().from("trainings").update({ responses_open: open }).eq("id", id));
}
