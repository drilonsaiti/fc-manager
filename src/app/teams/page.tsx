import type { Metadata } from "next";
import { TeamDiscovery, type PublicChallengeRow, type PublicMatchRow, type PublicTeamRow } from "@/components/public/TeamDiscovery";
import { serviceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Find teams and matches",
  description: "Browse public football teams, upcoming matches and open opponent challenges.",
};

export default async function TeamsPage() {
  const db = serviceClient();
  const [teamResult, matchResult, challengeResult] = await Promise.all([
    db.rpc("public_team_directory", { p_limit: 100, p_offset: 0 }),
    db.rpc("public_upcoming_matches", { p_limit: 100, p_offset: 0 }),
    db.rpc("public_open_challenges", { p_limit: 100, p_offset: 0 }),
  ]);
  const teams = (teamResult.data ?? []) as PublicTeamRow[];
  const matches = (matchResult.data ?? []) as PublicMatchRow[];
  const challenges = (challengeResult.data ?? []) as PublicChallengeRow[];
  return <TeamDiscovery teams={teams} matches={matches} challenges={challenges} />;
}
