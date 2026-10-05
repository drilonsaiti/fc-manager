import {
  collection, doc, getDoc, setDoc, updateDoc, onSnapshot,
  serverTimestamp, writeBatch, Timestamp,
} from "firebase/firestore";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { db, auth } from "./config";
import { generateToken } from "@/features/availability/logic";
import type {
  AvailabilityResponse, AvailabilityStatus, Match, RosterPlayer, ShareLink, ShareRosterEntry,
} from "@/types";

const linkRef = (token: string) => doc(db, "shareLinks", token);

function toRoster(players: RosterPlayer[]): ShareRosterEntry[] {
  return players
    .filter((p) => p.active)
    .map((p) => ({ id: p.id, name: p.name, number: p.number ?? null }));
}

function toLink(token: string, d: Record<string, unknown>): ShareLink {
  return {
    token,
    teamId: String(d.teamId),
    kind: "match",
    refId: String(d.refId),
    title: String(d.title ?? ""),
    date: (d.date as Timestamp | undefined)?.toDate() ?? new Date(),
    location: String(d.location ?? ""),
    roster: (d.roster as ShareRosterEntry[] | undefined) ?? [],
    rosterIds: (d.rosterIds as string[] | undefined) ?? [],
    closed: d.closed === true,
    createdAt: (d.createdAt as Timestamp | undefined)?.toDate() ?? new Date(),
  };
}

// ── Coach side ────────────────────────────────────────────────────────────

/** Creates the public link for a match and stores its token on the match. */
export async function createMatchShareLink(match: Match, roster: RosterPlayer[]): Promise<string> {
  const token = generateToken();
  const entries = toRoster(roster);
  const batch = writeBatch(db);
  batch.set(linkRef(token), {
    teamId: match.teamId,
    kind: "match",
    refId: match.id,
    title: `vs ${match.opponent}`,
    date: Timestamp.fromDate(match.date),
    location: match.location,
    roster: entries,
    rosterIds: entries.map((e) => e.id),
    closed: false,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, "matches", match.id), { shareToken: token });
  await batch.commit();
  return token;
}

/** Keeps the public roster, title and kickoff in step with the coach's data. */
export async function syncShareLink(token: string, match: Match, roster: RosterPlayer[]) {
  const entries = toRoster(roster);
  await updateDoc(linkRef(token), {
    title: `vs ${match.opponent}`,
    date: Timestamp.fromDate(match.date),
    location: match.location,
    roster: entries,
    rosterIds: entries.map((e) => e.id),
  });
}

export function subscribeToShareLink(token: string, cb: (link: ShareLink | null) => void) {
  return onSnapshot(linkRef(token), (snap) => cb(snap.exists() ? toLink(token, snap.data()) : null));
}

export function subscribeToResponses(token: string, cb: (r: AvailabilityResponse[]) => void) {
  return onSnapshot(collection(db, "shareLinks", token, "responses"), (snap) =>
    cb(snap.docs.map((d) => {
      const data = d.data();
      return {
        playerId: d.id,
        status: data.status as AvailabilityStatus,
        updatedAt: (data.updatedAt as Timestamp | undefined)?.toDate() ?? new Date(),
      };
    }))
  );
}

// ── Public (player) side ──────────────────────────────────────────────────

/** Resolves once there is a signed-in user, creating an anonymous one if needed. */
export function ensureSession(): Promise<void> {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user) { resolve(); return; }
      signInAnonymously(auth).then(() => resolve(), reject);
    });
  });
}

export async function fetchShareLink(token: string): Promise<ShareLink | null> {
  const snap = await getDoc(linkRef(token));
  return snap.exists() ? toLink(token, snap.data()) : null;
}

/** Used by players (public page) and by the coach answering on a player's behalf. */
export async function submitResponse(token: string, playerId: string, status: AvailabilityStatus) {
  await setDoc(doc(db, "shareLinks", token, "responses", playerId), {
    playerId,
    status,
    updatedAt: serverTimestamp(),
  });
}
