"use client";
import { useEffect, useState } from "react";
import { subscribeToMatchAvailability, setAvailability } from "@/lib/firebase/firestore";
import type { Availability, AvailabilityStatus, AvailabilitySummary, User } from "@/types";

export function useAvailability(matchId: string | undefined) {
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId) { setLoading(false); return; }
    const unsub = subscribeToMatchAvailability(matchId, (data) => { setAvailabilities(data); setLoading(false); });
    return () => unsub();
  }, [matchId]);

  const summary: AvailabilitySummary = {
    yes: availabilities.filter((a) => a.status === "yes"),
    no: availabilities.filter((a) => a.status === "no"),
    maybe: availabilities.filter((a) => a.status === "maybe"),
    total: availabilities.length,
  };

  const getUserStatus = (userId: string): AvailabilityStatus | null =>
    availabilities.find((a) => a.userId === userId)?.status ?? null;

  const respond = async (userId: string, status: AvailabilityStatus, user: User) => {
    if (!matchId) return;
    await setAvailability(matchId, userId, status, {
      name: user.name, position: user.position, jerseyNumber: user.jerseyNumber, photoURL: user.photoURL,
    });
  };

  return { availabilities, summary, loading, getUserStatus, respond };
}
