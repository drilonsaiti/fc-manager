"use client";
import { useEffect, useState } from "react";
import { subscribeToTeamTrainings } from "@/lib/firebase/firestore";
import type { Training } from "@/types";

export function useTrainings(teamId: string | undefined) {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) return;
    const unsub = subscribeToTeamTrainings(teamId, (data) => { setTrainings(data); setLoading(false); });
    return () => unsub();
  }, [teamId]);

  const now = new Date();
  return {
    trainings,
    loading,
    upcoming: trainings.filter((t) => t.date >= now),
    past: trainings.filter((t) => t.date < now),
  };
}
