import {
  collection, doc, addDoc, updateDoc, getDocs, query, where,
  onSnapshot, serverTimestamp, writeBatch, Timestamp,
} from "firebase/firestore";
import { db } from "./config";
import type { RosterPlayer } from "@/types";

const rosterCol = (teamId: string) => collection(db, "teams", teamId, "players");

function toPlayer(teamId: string, id: string, data: Record<string, unknown>): RosterPlayer {
  return {
    id,
    teamId,
    name: String(data.name ?? ""),
    number: (data.number as number | null | undefined) ?? null,
    positions: Array.isArray(data.positions) ? (data.positions as string[]) : [],
    phone: (data.phone as string | null | undefined) ?? null,
    photoURL: (data.photoURL as string | null | undefined) ?? null,
    active: data.active !== false,
    createdAt: (data.createdAt as Timestamp | undefined)?.toDate() ?? new Date(),
  };
}

export function subscribeToRoster(teamId: string, cb: (players: RosterPlayer[]) => void) {
  return onSnapshot(rosterCol(teamId), (snap) => {
    const players = snap.docs.map((d) => toPlayer(teamId, d.id, d.data()));
    players.sort((a, b) => a.name.localeCompare(b.name));
    cb(players);
  });
}

export type RosterInput = {
  name: string;
  number?: number | null;
  positions: string[];
  phone?: string | null;
};

export async function addRosterPlayer(teamId: string, input: RosterInput) {
  const ref = await addDoc(rosterCol(teamId), {
    name: input.name.trim(),
    number: input.number ?? null,
    positions: input.positions,
    phone: input.phone?.trim() || null,
    photoURL: null,
    active: true,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateRosterPlayer(teamId: string, playerId: string, input: Partial<RosterInput> & { active?: boolean }) {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.number !== undefined) patch.number = input.number;
  if (input.positions !== undefined) patch.positions = input.positions;
  if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;
  if (input.active !== undefined) patch.active = input.active;
  await updateDoc(doc(db, "teams", teamId, "players", playerId), patch);
}

/**
 * One-time import of the old account-based players into the roster.
 * The roster id equals the old user id, so historical stats keep matching.
 * Existing roster docs are never overwritten.
 */
export async function migrateLegacyPlayers(teamId: string, existingIds: Set<string>) {
  const snap = await getDocs(query(collection(db, "users"), where("teamId", "==", teamId)));
  const batch = writeBatch(db);
  let count = 0;
  snap.docs.forEach((d) => {
    const u = d.data();
    if (u.role !== "player" || existingIds.has(d.id)) return;
    batch.set(doc(db, "teams", teamId, "players", d.id), {
      name: u.name ?? "Player",
      number: u.jerseyNumber ?? null,
      positions: u.position ? [u.position] : [],
      phone: null,
      photoURL: u.photoURL ?? null,
      active: true,
      createdAt: serverTimestamp(),
    });
    count++;
  });
  if (count > 0) await batch.commit();
  return count;
}
