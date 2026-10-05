"use client";
import { useEffect, useMemo, useState } from "react";
import { subscribeToTeamMatches } from "@/lib/firebase/firestore";
import type { Match } from "@/types";

export function useMatches(teamId: string | undefined) {
  const [data, setData] = useState<{ teamId: string; matches: Match[] } | null>(null);

  useEffect(() => {
    if (!teamId) return;
    return subscribeToTeamMatches(teamId, (matches) => setData({ teamId, matches }));
  }, [teamId]);

  const loaded = !!teamId && data?.teamId === teamId;
  const matches = useMemo(() => (loaded && data ? data.matches : []), [loaded, data]);

  const upcomingMatches = useMemo(
    () => matches.filter((m) => m.status === "upcoming").sort((a, b) => a.date.getTime() - b.date.getTime()),
    [matches],
  );
  const finishedMatches = useMemo(() => matches.filter((m) => m.status === "finished"), [matches]);

  return { matches, upcomingMatches, finishedMatches, nextMatch: upcomingMatches[0], loading: !!teamId && !loaded };
}
