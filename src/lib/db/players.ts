import { supabase } from "@/lib/supabase/client";
import { check, unwrap } from "./util";
import type { Player } from "@/types";

interface PlayerRow {
  id: string; team_id: string; name: string; shirt_number: number | null;
  positions: string[]; phone: string | null; active: boolean;
}

export const toPlayer = (r: PlayerRow): Player => ({
  id: r.id, teamId: r.team_id, name: r.name, number: r.shirt_number,
  positions: r.positions ?? [], phone: r.phone, active: r.active,
});

export async function listPlayers(teamId: string): Promise<Player[]> {
  const rows = unwrap(await supabase().from("players")
    .select("id, team_id, name, shirt_number, positions, phone, active")
    .eq("team_id", teamId).order("name")) as PlayerRow[];
  return rows.map(toPlayer);
}

export interface PlayerInput { name: string; number: number | null; positions: string[]; phone: string | null }

export async function addPlayer(teamId: string, input: PlayerInput): Promise<void> {
  check(await supabase().from("players").insert({
    team_id: teamId, name: input.name.trim(), shirt_number: input.number,
    positions: input.positions, phone: input.phone?.trim() || null,
  }));
}

export async function updatePlayer(id: string, patch: Partial<PlayerInput> & { active?: boolean }): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.number !== undefined) row.shirt_number = patch.number;
  if (patch.positions !== undefined) row.positions = patch.positions;
  if (patch.phone !== undefined) row.phone = patch.phone?.trim() || null;
  if (patch.active !== undefined) row.active = patch.active;
  check(await supabase().from("players").update(row).eq("id", id));
}
