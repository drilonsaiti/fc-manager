export type UserRole = "owner" | "coach" | "staff" | "player";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamId: string;
  position?: string;
  jerseyNumber?: number;
  photoURL?: string;
  createdAt: Date;
}

export interface Team {
  id: string;
  name: string;
  logo?: string;
  ownerId: string;
  createdAt: Date;
}

export type MatchStatus = "upcoming" | "finished" | "cancelled";
export type Competition = "league" | "cup" | "friendly" | "tournament";

export interface Match {
  id: string;
  teamId: string;
  opponent: string;
  date: Date;
  location: string;
  competition: Competition;
  status: MatchStatus;
  homeScore?: number | null;
  awayScore?: number | null;
  isHome: boolean;
  notes?: string | null;
  createdAt: Date;
}

export type AvailabilityStatus = "yes" | "no" | "maybe";

export interface Availability {
  id: string;
  matchId: string;
  userId: string;
  userName: string;
  userPosition?: string;
  userJerseyNumber?: number;
  userPhotoURL?: string;
  status: AvailabilityStatus;
  updatedAt: Date;
}

export interface Lineup {
  id: string;
  matchId: string;
  teamId: string;
  formation: string;
  squad: string[];
  startingXI: string[];
  updatedAt: Date;
}

export interface Training {
  id: string;
  teamId: string;
  title: string;
  date: Date;
  location: string;
  description?: string | null;
  createdAt: Date;
}

export interface TrainingAttendance {
  id: string;
  trainingId: string;
  userId: string;
  userName: string;
  status: AvailabilityStatus;
  updatedAt: Date;
}

export interface PlayerStat {
  id: string;
  userId: string;
  matchId: string;
  teamId: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
  rating?: number;
  updatedAt: Date;
}

export interface AvailabilitySummary {
  yes: Availability[];
  no: Availability[];
  maybe: Availability[];
  total: number;
}
