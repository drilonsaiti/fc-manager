"use client";
import { useEffect, useMemo, useState } from "react";
import { subscribeToRoster } from "@/lib/firebase/roster";
import type { RosterPlayer } from "@/types";

export function useRoster(teamId: string | undefined) {
  const [data, setData] = useState<{ teamId: string; players: RosterPlayer[] } | null>(null);

  useEffect(() => {
    if (!teamId) return;
    return subscribeToRoster(teamId, (players) => setData({ teamId, players }));
  }, [teamId]);

  const loaded = !!teamId && data?.teamId === teamId;
  const players = useMemo(() => (loaded && data ? data.players : []), [loaded, data]);
  const active = useMemo(() => players.filter((p) => p.active), [players]);
  const archived = useMemo(() => players.filter((p) => !p.active), [players]);

  return { players, active, archived, loading: !!teamId && !loaded };
}
