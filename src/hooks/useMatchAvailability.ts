"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createMatchShareLink, submitResponse, subscribeToResponses, subscribeToShareLink, syncShareLink,
} from "@/lib/firebase/availability";
import { buildRows, summarize } from "@/features/availability/logic";
import type {
  AvailabilityResponse, AvailabilityStatus, Match, RosterPlayer, ShareLink,
} from "@/types";

const NO_RESPONSES: AvailabilityResponse[] = [];

/**
 * Availability for one match = active roster joined with the public link's responses.
 * Players who have not answered show up as "none" (No response).
 *
 * `manage` lets the coach create the link and keep its roster in sync; read-only
 * callers (dashboard) leave it off so they never write.
 */
export function useMatchAvailability(
  match: Match | undefined,
  roster: RosterPlayer[],
  { manage = false }: { manage?: boolean } = {},
) {
  const matchId = match?.id;
  const [createdToken, setCreatedToken] = useState<{ matchId: string; token: string } | null>(null);
  const token = match?.shareToken ?? (createdToken?.matchId === matchId ? createdToken?.token : undefined) ?? undefined;

  const [responsesState, setResponsesState] = useState<{ token: string; list: AvailabilityResponse[] } | null>(null);
  const [linkState, setLinkState] = useState<{ token: string; link: ShareLink | null } | null>(null);

  useEffect(() => {
    if (!token) return;
    const unsubResponses = subscribeToResponses(token, (list) => setResponsesState({ token, list }));
    const unsubLink = subscribeToShareLink(token, (link) => setLinkState({ token, link }));
    return () => { unsubResponses(); unsubLink(); };
  }, [token]);

  const responses = responsesState && responsesState.token === token ? responsesState.list : NO_RESPONSES;
  const link = linkState && linkState.token === token ? linkState.link : null;
  const loading = !!token && (responsesState?.token !== token || linkState?.token !== token);

  const entries = useMemo(
    () => roster.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, number: p.number ?? null })),
    [roster],
  );
  const rows = useMemo(() => buildRows(entries, responses), [entries, responses]);
  const summary = useMemo(() => summarize(rows), [rows]);

  // Keep the public page's roster/kickoff current. Only writes when something differs.
  const lastSync = useRef("");
  useEffect(() => {
    if (!manage || !match || !token || !link || entries.length === 0) return;
    const wanted = JSON.stringify([entries.map((e) => [e.id, e.name, e.number]), match.opponent, match.date.getTime(), match.location]);
    const current = JSON.stringify([link.roster.map((e) => [e.id, e.name, e.number ?? null]), link.title.replace(/^vs /, ""), link.date.getTime(), link.location]);
    if (wanted === current || lastSync.current === wanted) return;
    lastSync.current = wanted;
    syncShareLink(token, match, roster).catch(() => { lastSync.current = ""; });
  }, [manage, match, token, link, entries, roster]);

  const ensureLink = useCallback(async (): Promise<string | undefined> => {
    if (!match) return undefined;
    if (token) return token;
    const created = await createMatchShareLink(match, roster);
    setCreatedToken({ matchId: match.id, token: created });
    return created;
  }, [match, token, roster]);

  /** Coach answering on a player's behalf (e.g. a player replied on WhatsApp). */
  const setStatus = useCallback(async (playerId: string, status: AvailabilityStatus) => {
    const t = await ensureLink();
    if (t) await submitResponse(t, playerId, status);
  }, [ensureLink]);

  return { token, rows, summary, loading, ensureLink, setStatus };
}
