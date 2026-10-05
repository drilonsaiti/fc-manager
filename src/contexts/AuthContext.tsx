"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { fetchClub, type Membership } from "@/lib/db/teams";
import { friendlyError } from "@/lib/db/util";
import type { Member, Season, Team } from "@/types";

interface Ctx {
  /** True until we know whether someone is signed in and which club they belong to. */
  loading: boolean;
  /** Set when the club could not be loaded (e.g. a permission or network error). */
  loadError: string | null;
  userId: string | null;
  email: string | null;
  /** The current team and the user's role in it. */
  member: Member | null;
  team: Team | null;
  /** Every team the user belongs to (e.g. U19, U17). */
  teams: Membership[];
  switchTeam: (teamId: string) => void;
  /** Seasons of the current team. */
  seasons: Season[];
  /** The season new matches/trainings go into and stats are shown for. */
  season: Season | null;
  setSeasonId: (id: string) => void;
  canManage: boolean;
  isOwner: boolean;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<Ctx | null>(null);

interface Loaded { memberships: Membership[]; seasons: Season[]; error: string | null }
const EMPTY: Loaded = { memberships: [], seasons: [], error: null };
const TEAM_KEY = "fcm:team";

function storedTeam(): string | null {
  try { return localStorage.getItem(TEAM_KEY); } catch { return null; }
}

async function loadClub(userId: string): Promise<Loaded> {
  const club = await fetchClub(userId);
  return club ? { ...club, error: null } : EMPTY;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [club, setClub] = useState<{ userId: string; data: Loaded } | null>(null);
  const [chosenSeason, setChosenSeason] = useState<string | null>(null);
  const [chosenTeam, setChosenTeam] = useState<string | null>(null);

  const switchTeam = useCallback((id: string) => {
    setChosenTeam(id);
    setChosenSeason(null);
    try { localStorage.setItem(TEAM_KEY, id); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const { data } = supabase().auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setSessionReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadClub(userId)
      .then((data) => { if (!cancelled) setClub({ userId, data }); })
      .catch((e) => { if (!cancelled) setClub({ userId, data: { ...EMPTY, error: friendlyError(e, e instanceof Error ? e.message : undefined) } }); });
    return () => { cancelled = true; };
  }, [userId]);

  const reload = useCallback(async () => {
    if (!userId) return;
    const data = await loadClub(userId);
    setClub({ userId, data });
  }, [userId]);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    setClub(null);
  }, []);

  const value = useMemo<Ctx>(() => {
    const data = club && club.userId === userId ? club.data : EMPTY;
    const loading = !sessionReady || (!!userId && !(club && club.userId === userId));
    const wanted = chosenTeam ?? (data.memberships.length > 1 ? storedTeam() : null);
    const current = data.memberships.find((m) => m.team.id === wanted) ?? data.memberships[0] ?? null;
    const seasons = current ? data.seasons.filter((x) => x.teamId === current.team.id) : [];
    const season = seasons.find((x) => x.id === chosenSeason) ?? seasons.find((x) => x.isActive) ?? seasons[0] ?? null;
    const role = current?.member.role;
    return {
      loading, loadError: data.error, userId, email: session?.user.email ?? null,
      member: current?.member ?? null, team: current?.team ?? null, teams: data.memberships, switchTeam,
      seasons, season,
      setSeasonId: setChosenSeason,
      canManage: role === "owner" || role === "coach" || role === "staff",
      isOwner: role === "owner",
      reload, signOut,
    };
  }, [club, userId, sessionReady, session, chosenSeason, chosenTeam, switchTeam, reload, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
