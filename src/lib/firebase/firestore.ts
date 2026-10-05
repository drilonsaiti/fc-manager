import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, orderBy, onSnapshot,
  serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from "./config";
import type {
  Match, Availability, AvailabilityStatus, Lineup,
  Training, TrainingAttendance, PlayerStat, User, Team,
} from "@/types";

// ── Teams ──────────────────────────────────────────────────────────────────

export async function createTeam(name: string, ownerId: string) {
  const ref = await addDoc(collection(db, "teams"), {
    name: name.trim(), ownerId, createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getTeam(teamId: string) {
  const snap = await getDoc(doc(db, "teams", teamId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Team) : null;
}

// ── Users ──────────────────────────────────────────────────────────────────

export function subscribeToTeamPlayers(teamId: string, cb: (p: User[]) => void) {
  const q = query(collection(db, "users"), where("teamId", "==", teamId));
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => {
      const data = d.data();
      return { ...data, id: d.id, createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date() } as User;
    }))
  );
}

export async function updateUserProfile(userId: string, data: Partial<User>) {
  await updateDoc(doc(db, "users", userId), { ...data });
}

// ── Matches ────────────────────────────────────────────────────────────────

export async function createMatch(matchData: Omit<Match, "id" | "createdAt">) {
  const ref = await addDoc(collection(db, "matches"), {
    ...matchData,
    notes: matchData.notes ?? null,
    homeScore: matchData.homeScore ?? null,
    awayScore: matchData.awayScore ?? null,
    date: Timestamp.fromDate(matchData.date),
    createdAt: serverTimestamp(),
  });
  await updateDoc(ref, { id: ref.id });
  return ref.id;
}

export async function updateMatch(matchId: string, data: Partial<Match>) {
  const update: Record<string, unknown> = {
    ...data,
    notes: data.notes ?? null,
    homeScore: data.homeScore ?? null,
    awayScore: data.awayScore ?? null,
  };
  if (data.date) update.date = Timestamp.fromDate(data.date);
  await updateDoc(doc(db, "matches", matchId), update);
}

export async function deleteMatch(matchId: string) {
  await deleteDoc(doc(db, "matches", matchId));
}

export function subscribeToTeamMatches(teamId: string, cb: (m: Match[]) => void) {
  const q = query(collection(db, "matches"), where("teamId", "==", teamId), orderBy("date", "desc"));
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => {
      const data = d.data();
      return { ...data, id: d.id, date: (data.date as Timestamp)?.toDate() ?? new Date(), createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date() } as Match;
    }))
  );
}

export async function getMatch(matchId: string): Promise<Match | null> {
  const snap = await getDoc(doc(db, "matches", matchId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return { ...data, id: snap.id, date: (data.date as Timestamp)?.toDate() ?? new Date(), createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date() } as Match;
}

// ── Availability ──────────────────────────────────────────────────────────

export async function setAvailability(
  matchId: string, userId: string, status: AvailabilityStatus,
  userInfo: { name: string; position?: string; jerseyNumber?: number; photoURL?: string }
) {
  const id = `${matchId}_${userId}`;
  await setDoc(doc(db, "availabilities", id), {
    id, matchId, userId,
    userName: userInfo.name,
    userPosition: userInfo.position ?? null,
    userJerseyNumber: userInfo.jerseyNumber ?? null,
    userPhotoURL: userInfo.photoURL ?? null,
    status, updatedAt: serverTimestamp(),
  });
}

export function subscribeToMatchAvailability(matchId: string, cb: (a: Availability[]) => void) {
  const q = query(collection(db, "availabilities"), where("matchId", "==", matchId));
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => {
      const data = d.data();
      return { ...data, id: d.id, updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date() } as Availability;
    }))
  );
}

// ── Lineup ────────────────────────────────────────────────────────────────

export async function saveLineup(matchId: string, teamId: string, formation: string, squad: string[], startingXI: string[]) {
  await setDoc(doc(db, "lineups", matchId), {
    id: matchId, matchId, teamId, formation, squad, startingXI, updatedAt: serverTimestamp(),
  });
}

export function subscribeToLineup(matchId: string, cb: (l: Lineup | null) => void) {
  return onSnapshot(doc(db, "lineups", matchId), (snap) =>
    cb(snap.exists() ? { ...snap.data(), updatedAt: (snap.data().updatedAt as Timestamp)?.toDate() ?? new Date() } as Lineup : null)
  );
}

// ── Training ──────────────────────────────────────────────────────────────

export async function createTraining(data: Omit<Training, "id" | "createdAt">) {
  const ref = await addDoc(collection(db, "trainings"), {
    ...data,
    description: data.description ?? null,
    date: Timestamp.fromDate(data.date),
    createdAt: serverTimestamp(),
  });
  await updateDoc(ref, { id: ref.id });
  return ref.id;
}

export function subscribeToTeamTrainings(teamId: string, cb: (t: Training[]) => void) {
  const q = query(collection(db, "trainings"), where("teamId", "==", teamId), orderBy("date", "desc"));
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => {
      const data = d.data();
      return { ...data, id: d.id, date: (data.date as Timestamp)?.toDate() ?? new Date(), createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date() } as Training;
    }))
  );
}

export async function setTrainingAttendance(trainingId: string, userId: string, status: AvailabilityStatus, userName: string) {
  const id = `${trainingId}_${userId}`;
  await setDoc(doc(db, "training_attendance", id), { id, trainingId, userId, userName, status, updatedAt: serverTimestamp() });
}

export function subscribeToTrainingAttendance(trainingId: string, cb: (a: TrainingAttendance[]) => void) {
  const q = query(collection(db, "training_attendance"), where("trainingId", "==", trainingId));
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => {
      const data = d.data();
      return { ...data, id: d.id, updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date() } as TrainingAttendance;
    }))
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────

export async function savePlayerStat(stat: Omit<PlayerStat, "id" | "updatedAt">) {
  const id = `${stat.matchId}_${stat.userId}`;
  await setDoc(doc(db, "stats", id), { ...stat, id, updatedAt: serverTimestamp() });
}

export async function getTeamStats(teamId: string): Promise<PlayerStat[]> {
  const snap = await getDocs(query(collection(db, "stats"), where("teamId", "==", teamId)));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id, updatedAt: (d.data().updatedAt as Timestamp)?.toDate() ?? new Date() } as PlayerStat));
}

export async function getPlayerStats(userId: string, teamId: string): Promise<PlayerStat[]> {
  const snap = await getDocs(query(collection(db, "stats"), where("userId", "==", userId), where("teamId", "==", teamId)));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id, updatedAt: (d.data().updatedAt as Timestamp)?.toDate() ?? new Date() } as PlayerStat));
}
