import { supabase } from "@/lib/supabase/client";
import { check, unwrap } from "./util";
import type { Member, Role, Season, Team } from "@/types";

interface MemberRow { team_id: string; user_id: string; role: Role; display_name: string }
interface SeasonRow { id: string; team_id: string; name: string; is_active: boolean }

const toMember = (r: MemberRow): Member => ({ userId: r.user_id, teamId: r.team_id, role: r.role, displayName: r.display_name });
const toSeason = (r: SeasonRow): Season => ({ id: r.id, teamId: r.team_id, name: r.name, isActive: r.is_active });

export async function fetchMembership(userId: string): Promise<Member | null> {
  const rows = unwrap(await supabase().from("team_members").select("team_id, user_id, role, display_name")
    .eq("user_id", userId).order("created_at").limit(1)) as MemberRow[];
  return rows[0] ? toMember(rows[0]) : null;
}

/**
 * Membership, club and seasons in one round trip (two requests in parallel).
 * Row Level Security already limits seasons to clubs the user belongs to.
 */
export async function fetchClub(userId: string): Promise<{ member: Member; team: Team; seasons: Season[] } | null> {
  const [mem, sea] = await Promise.all([
    supabase().from("team_members").select("team_id, user_id, role, display_name, teams(id, name)")
      .eq("user_id", userId).order("created_at").limit(1),
    supabase().from("seasons").select("id, team_id, name, is_active").order("created_at", { ascending: false }),
  ]);
  const rows = unwrap(mem) as unknown as (MemberRow & { teams: Team | Team[] | null })[];
  const row = rows[0];
  if (!row) return null;
  const embedded = Array.isArray(row.teams) ? row.teams[0] : row.teams;
  const seasons = (unwrap(sea) as SeasonRow[]).filter((x) => x.team_id === row.team_id).map(toSeason);
  return { member: toMember(row), team: embedded ?? { id: row.team_id, name: "" }, seasons };
}

export async function fetchTeam(teamId: string): Promise<Team | null> {
  const rows = unwrap(await supabase().from("teams").select("id, name").eq("id", teamId).limit(1)) as Team[];
  return rows[0] ?? null;
}

export async function fetchSeasons(teamId: string): Promise<Season[]> {
  const rows = unwrap(await supabase().from("seasons").select("id, team_id, name, is_active")
    .eq("team_id", teamId).order("created_at", { ascending: false })) as SeasonRow[];
  return rows.map(toSeason);
}

export async function createTeam(name: string, displayName: string): Promise<{ teamId: string; seasonId: string }> {
  const res = unwrap(await supabase().rpc("create_team", { p_name: name, p_display_name: displayName })) as { team_id: string; season_id: string };
  return { teamId: res.team_id, seasonId: res.season_id };
}

export async function joinTeam(code: string, displayName: string): Promise<string> {
  return unwrap(await supabase().rpc("join_team", { p_code: code, p_display_name: displayName })) as string;
}

export async function startSeason(teamId: string, name: string): Promise<string> {
  return unwrap(await supabase().rpc("start_new_season", { p_team: teamId, p_name: name })) as string;
}

export async function renameTeam(teamId: string, name: string): Promise<void> {
  check(await supabase().from("teams").update({ name: name.trim() }).eq("id", teamId));
}

export async function listMembers(teamId: string): Promise<Member[]> {
  const rows = unwrap(await supabase().from("team_members").select("team_id, user_id, role, display_name")
    .eq("team_id", teamId).order("created_at")) as MemberRow[];
  return rows.map(toMember);
}

export async function removeMember(teamId: string, userId: string): Promise<void> {
  check(await supabase().from("team_members").delete().eq("team_id", teamId).eq("user_id", userId));
}

export interface Invite { code: string; role: "coach" | "staff"; expiresAt: Date }

export async function listInvites(teamId: string): Promise<Invite[]> {
  const rows = unwrap(await supabase().from("team_invites").select("code, role, expires_at")
    .eq("team_id", teamId).is("used_at", null).gt("expires_at", new Date().toISOString())
    .order("expires_at")) as { code: string; role: "coach" | "staff"; expires_at: string }[];
  return rows.map((r) => ({ code: r.code, role: r.role, expiresAt: new Date(r.expires_at) }));
}

export async function createInvite(teamId: string, role: "coach" | "staff", userId: string): Promise<string> {
  const rows = unwrap(await supabase().from("team_invites").insert({ team_id: teamId, role, created_by: userId })
    .select("code")) as { code: string }[];
  return rows[0].code;
}

export async function deleteInvite(code: string): Promise<void> {
  check(await supabase().from("team_invites").delete().eq("code", code));
}
