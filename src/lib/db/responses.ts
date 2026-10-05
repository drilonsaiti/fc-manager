import { supabase } from "@/lib/supabase/client";
import { check, toDate, unwrap } from "./util";
import type { AvailabilityStatus, EventKind, Response } from "@/types";

const CONFIG = {
  match: { table: "match_responses", key: "match_id", columns: "player_id, status, updated_at" },
  training: { table: "training_responses", key: "training_id", columns: "player_id, status, attended, updated_at" },
} as const;

interface ResponseRow { player_id: string; status: AvailabilityStatus | null; attended?: boolean; updated_at: string }

export async function listResponses(kind: EventKind, eventId: string): Promise<Response[]> {
  const c = CONFIG[kind];
  const rows = unwrap(await supabase().from(c.table).select(c.columns).eq(c.key, eventId)) as unknown as ResponseRow[];
  return rows.map((r) => ({ playerId: r.player_id, status: r.status, attended: r.attended ?? false, updatedAt: toDate(r.updated_at) }));
}

/** Coach answering on a player's behalf (players answer through the public link). */
export async function setResponse(kind: EventKind, eventId: string, teamId: string, playerId: string, status: AvailabilityStatus): Promise<void> {
  const c = CONFIG[kind];
  check(await supabase().from(c.table).upsert(
    { [c.key]: eventId, team_id: teamId, player_id: playerId, status },
    { onConflict: `${c.key},player_id` },
  ));
}

/** Who actually turned up to a training (independent of what they answered). */
export async function setAttended(trainingId: string, teamId: string, playerId: string, attended: boolean): Promise<void> {
  check(await supabase().from("training_responses").upsert(
    { training_id: trainingId, team_id: teamId, player_id: playerId, attended },
    { onConflict: "training_id,player_id" },
  ));
}
