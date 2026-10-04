"use client";
import { useEffect, useState } from "react";
import { subscribeToTeamPlayers } from "@/lib/firebase/firestore";
import type { User } from "@/types";

export function usePlayers(teamId: string | undefined) {
  const [players, setPlayers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) return;
    const unsub = subscribeToTeamPlayers(teamId, (data) => { setPlayers(data); setLoading(false); });
    return () => unsub();
  }, [teamId]);

  return {
    players,
    loading,
    allPlayers: players.filter((p) => p.role === "player"),
    staff: players.filter((p) => p.role !== "player"),
  };
}
