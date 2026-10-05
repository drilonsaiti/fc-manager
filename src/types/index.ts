// Domain types. Database rows are snake_case; repositories in lib/db map them to these.

export type Role = "owner" | "coach" | "staff";

export interface Team { id: string; name: string; strictLinks: boolean }

export interface Member {
  userId: string;
  teamId: string;
  role: Role;
  displayName: string;
}

export interface Season { id: string; teamId: string; name: string; isActive: boolean }

/** A squad member. Does not need an account. */
export interface Player {
  id: string;
  teamId: string;
  name: string;
  number: number | null;
  /** First entry is the primary position. */
  positions: string[];
  phone: string | null;
  active: boolean;
  /** Private code that turns an event link into this player's personal link. Coaches only. */
  accessCode: string;
}

export type MatchStatus = "scheduled" | "live" | "final" | "cancelled";
export type Competition = "league" | "cup" | "friendly" | "tournament";

export interface Match {
  id: string;
  teamId: string;
  seasonId: string | null;
  opponent: string;
  kickoff: Date;
  venue: string;
  competition: Competition;
  isHome: boolean;
  status: MatchStatus;
  durationMinutes: number;
  startedAt: Date | null;
  ourScore: number | null;
  theirScore: number | null;
  notes: string | null;
  shareToken: string;
  responsesOpen: boolean;
}

export type AvailabilityStatus = "yes" | "maybe" | "no";
/** What the coach sees per player: an answer, or nothing yet. */
export type AvailabilityState = AvailabilityStatus | "none";

export type EventKind = "match" | "training";

export interface Training {
  id: string;
  teamId: string;
  seasonId: string | null;
  startsAt: Date;
  location: string;
  kind: TrainingKind | null;
  notes: string | null;
  shareToken: string;
  responsesOpen: boolean;
}
export type TrainingKind = "fitness" | "technical" | "tactical" | "match_practice" | "other";

export interface Response {
  playerId: string;
  status: AvailabilityStatus | null;
  attended: boolean;
  updatedAt: Date;
}

export type LineupRole = "starter" | "bench";

export interface LineupEntry {
  playerId: string;
  role: LineupRole;
  slotId: string | null;
  x: number | null;
  y: number | null;
  sort: number;
}

export interface Lineup { matchId: string; formation: string; entries: LineupEntry[] }

export type EventType = "goal" | "own_goal" | "yellow" | "red" | "sub";
export type Side = "us" | "them";

export interface MatchEvent {
  id: string;
  matchId: string;
  type: EventType;
  side: Side;
  minute: number;
  playerId: string | null;
  /** Assist (for a goal) or the player coming on (for a substitution). */
  relatedPlayerId: string | null;
  createdAt: Date;
}

export interface PlayerMatchStat {
  playerId: string;
  started: boolean;
  minutes: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  ownGoals: number;
}

export interface SeasonPlayerStat {
  playerId: string;
  appearances: number;
  starts: number;
  subAppearances: number;
  minutes: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  ownGoals: number;
  wins: number;
  draws: number;
  losses: number;
}

/** What the public availability page receives (no private data). */
export interface PublicEvent {
  kind: EventKind;
  title: string;
  startsAt: string;
  place: string;
  team: string;
  closed: boolean;
  teamId: string;
  /** Club only accepts personal links; the shared link lists no names. */
  strict: boolean;
  /** Set when the link carried a valid personal code. */
  me: { id: string; name: string; number: number | null } | null;
  roster: { id: string; name: string; number: number | null }[];
}
