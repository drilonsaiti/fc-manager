"use client";
import useSWR from "swr";
import { useMemo } from "react";
import { listPlayers } from "@/lib/db/players";
import { getMatch, listMatches } from "@/lib/db/matches";
import { listTrainings } from "@/lib/db/trainings";
import { listResponses } from "@/lib/db/responses";
import { getLineup } from "@/lib/db/lineup";
import { listEvents } from "@/lib/db/events";
import { fetchSeasonStats, fetchTrainingAttendance } from "@/lib/db/stats";
import { buildRows, summarize } from "@/features/availability/logic";
import type { EventKind } from "@/types";

const opts = { revalidateOnFocus: true, dedupingInterval: 2000 } as const;

export function usePlayers(teamId: string | undefined) {
  const r = useSWR(teamId ? ["players", teamId] : null, () => listPlayers(teamId!), opts);
  return { players: r.data ?? [], loading: !r.data && !r.error, error: r.error, mutate: r.mutate };
}

export function useMatches(teamId: string | undefined, seasonId: string | undefined) {
  const r = useSWR(teamId && seasonId ? ["matches", teamId, seasonId] : null, () => listMatches(teamId!, seasonId!), opts);
  return { matches: r.data ?? [], loading: !r.data && !r.error, error: r.error, mutate: r.mutate };
}

export function useMatch(id: string | undefined) {
  const r = useSWR(id ? ["match", id] : null, () => getMatch(id!), opts);
  return { match: r.data ?? null, loading: r.data === undefined && !r.error, error: r.error, mutate: r.mutate };
}

export function useTrainings(teamId: string | undefined, seasonId: string | undefined) {
  const r = useSWR(teamId && seasonId ? ["trainings", teamId, seasonId] : null, () => listTrainings(teamId!, seasonId!), opts);
  return { trainings: r.data ?? [], loading: !r.data && !r.error, error: r.error, mutate: r.mutate };
}

export function useLineup(matchId: string | undefined) {
  const r = useSWR(matchId ? ["lineup", matchId] : null, () => getLineup(matchId!), opts);
  return { lineup: r.data ?? null, loading: r.data === undefined && !r.error, mutate: r.mutate };
}

export function useEvents(matchId: string | undefined) {
  const r = useSWR(matchId ? ["events", matchId] : null, () => listEvents(matchId!), opts);
  return { events: r.data ?? [], loading: !r.data && !r.error, mutate: r.mutate };
}

/** Squad × responses for one match or training. Polls so answers appear while the coach watches. */
export function useAvailability(
  kind: EventKind,
  eventId: string | undefined,
  players: { id: string; name: string; number: number | null; active: boolean }[],
) {
  const r = useSWR(eventId ? ["responses", kind, eventId] : null, () => listResponses(kind, eventId!), {
    ...opts, refreshInterval: 15_000,
  });
  const responses = r.data;
  const rows = useMemo(
    () => buildRows(players.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, number: p.number })), responses ?? []),
    [players, responses],
  );
  const summary = useMemo(() => summarize(rows), [rows]);
  return { responses: responses ?? [], rows, summary, loading: !responses && !r.error, mutate: r.mutate };
}

export function useSeasonStats(teamId: string | undefined, seasonId: string | undefined) {
  const r = useSWR(teamId && seasonId ? ["season-stats", teamId, seasonId] : null, async () => {
    const [stats, training] = await Promise.all([fetchSeasonStats(teamId!, seasonId!), fetchTrainingAttendance(teamId!, seasonId!)]);
    return { stats, training };
  }, opts);
  return { data: r.data ?? null, loading: !r.data && !r.error, error: r.error };
}
