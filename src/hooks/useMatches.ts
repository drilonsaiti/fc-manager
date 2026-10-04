"use client";
import { useEffect, useState } from "react";
import { subscribeToTeamMatches } from "@/lib/firebase/firestore";
import type { Match } from "@/types";

export function useMatches(teamId: string | undefined) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) return;
    const unsub = subscribeToTeamMatches(teamId, (data) => { setMatches(data); setLoading(false); });
    return () => unsub();
  }, [teamId]);

  const upcomingMatches = matches.filter((m) => m.status === "upcoming").sort((a, b) => a.date.getTime() - b.date.getTime());
  const finishedMatches = matches.filter((m) => m.status === "finished");
  const nextMatch = upcomingMatches[0];

  return { matches, upcomingMatches, finishedMatches, nextMatch, loading };
}
