import type { AvailabilityState, LineupEntry } from "@/types";
import { DEFAULT_FORMATION, getFormation, type FormationSlot, type SlotRole } from "./formations";

export interface LineupState {
  formation: string;
  /** slotId → playerId (only filled slots). */
  slots: Record<string, string>;
  /** slotId → manual pitch position that overrides the formation's default. */
  offsets: Record<string, { x: number; y: number }>;
  /** Player ids, in display order. */
  bench: string[];
}

export function emptyLineup(formation = DEFAULT_FORMATION): LineupState {
  return { formation: getFormation(formation) ? formation : DEFAULT_FORMATION, slots: {}, offsets: {}, bench: [] };
}

const slotsOf = (s: LineupState): FormationSlot[] => getFormation(s.formation)?.slots ?? [];

export function positionOf(s: LineupState, slot: FormationSlot): { x: number; y: number } {
  return s.offsets[slot.id] ?? { x: slot.x, y: slot.y };
}

export function playerIds(s: LineupState): string[] {
  return [...Object.values(s.slots), ...s.bench];
}

export function slotOfPlayer(s: LineupState, playerId: string): string | null {
  return Object.keys(s.slots).find((k) => s.slots[k] === playerId) ?? null;
}

/** Take the player out of whichever slot / bench position they hold. */
function detach(s: LineupState, playerId: string): LineupState {
  const slots = { ...s.slots };
  for (const k of Object.keys(slots)) if (slots[k] === playerId) delete slots[k];
  return { ...s, slots, bench: s.bench.filter((id) => id !== playerId) };
}

/** Put a player into a slot. Whoever was there goes to the bench. */
export function placePlayer(s: LineupState, slotId: string, playerId: string): LineupState {
  if (!slotsOf(s).some((x) => x.id === slotId)) return s;
  const previous = s.slots[slotId];
  if (previous === playerId) return s;
  const from = slotOfPlayer(s, playerId);
  let next = detach(s, playerId);
  const offsets = { ...next.offsets };
  delete offsets[slotId];
  if (previous) {
    if (from) {
      // swap: the previous occupant takes the slot the incoming player left
      next = { ...next, slots: { ...next.slots, [from]: previous } };
    } else {
      next = { ...next, bench: [...next.bench, previous] };
    }
  }
  return { ...next, offsets, slots: { ...next.slots, [slotId]: playerId } };
}

export function benchPlayer(s: LineupState, playerId: string): LineupState {
  const next = detach(s, playerId);
  return { ...next, bench: [...next.bench, playerId] };
}

export function removePlayer(s: LineupState, playerId: string): LineupState {
  return detach(s, playerId);
}

/** Drag a starter to a new spot on the pitch (kept inside the touchline). */
export function movePlayer(s: LineupState, slotId: string, x: number, y: number): LineupState {
  if (!s.slots[slotId]) return s;
  const clamp = (v: number) => Math.min(96, Math.max(4, Math.round(v * 100) / 100));
  return { ...s, offsets: { ...s.offsets, [slotId]: { x: clamp(x), y: clamp(y) } } };
}

export function resetPositions(s: LineupState): LineupState {
  return { ...s, offsets: {} };
}

export function resetLineup(s: LineupState): LineupState {
  return emptyLineup(s.formation);
}

/**
 * Switch formation but keep people where they make sense: the keeper stays in goal,
 * defenders fill defensive slots, and so on. Anyone who no longer fits goes to the bench.
 */
export function changeFormation(s: LineupState, key: string): LineupState {
  const next = getFormation(key);
  if (!next || key === s.formation) return s;
  const old = slotsOf(s);
  const roleOf = new Map(old.map((x) => [x.id, x.role] as const));

  const byRole: Record<SlotRole, string[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const slot of old) {
    const p = s.slots[slot.id];
    if (p) byRole[slot.role].push(p);
  }
  void roleOf;

  const slots: Record<string, string> = {};
  const bench = [...s.bench];
  (["GK", "DEF", "MID", "FWD"] as SlotRole[]).forEach((role) => {
    const free = next.slots.filter((x) => x.role === role);
    byRole[role].forEach((p, i) => {
      if (free[i]) slots[free[i].id] = p;
      else bench.push(p);
    });
  });
  return { formation: key, slots, offsets: {}, bench };
}

export function startersOf(s: LineupState): { slot: FormationSlot; playerId: string }[] {
  return slotsOf(s).flatMap((slot) => (s.slots[slot.id] ? [{ slot, playerId: s.slots[slot.id] }] : []));
}

/** Rows to persist (see the save_lineup database function). */
export function toEntries(s: LineupState): LineupEntry[] {
  const starters: LineupEntry[] = startersOf(s).map(({ slot, playerId }) => {
    const pos = positionOf(s, slot);
    return { playerId, role: "starter", slotId: slot.id, x: pos.x, y: pos.y, sort: 0 };
  });
  const bench: LineupEntry[] = s.bench.map((playerId, i) => ({
    playerId, role: "bench", slotId: null, x: null, y: null, sort: i,
  }));
  return [...starters, ...bench];
}

export function fromEntries(formation: string, entries: LineupEntry[]): LineupState {
  const base = emptyLineup(formation);
  const slots = slotsOf(base);
  const state: LineupState = { ...base, slots: {}, offsets: {}, bench: [] };
  const overflow: string[] = [];

  for (const e of entries.filter((x) => x.role === "starter")) {
    const slot = slots.find((x) => x.id === e.slotId);
    if (!slot || state.slots[slot.id]) { overflow.push(e.playerId); continue; }
    state.slots[slot.id] = e.playerId;
    if (e.x != null && e.y != null && (Math.abs(e.x - slot.x) > 0.01 || Math.abs(e.y - slot.y) > 0.01)) {
      state.offsets[slot.id] = { x: e.x, y: e.y };
    }
  }
  const bench = entries.filter((x) => x.role === "bench").sort((a, b) => a.sort - b.sort).map((x) => x.playerId);
  state.bench = [...bench, ...overflow];
  return state;
}

/** Drop anyone who is no longer an active squad member (used when duplicating an old lineup). */
export function keepOnly(s: LineupState, allowed: Set<string>): LineupState {
  let next = s;
  for (const id of playerIds(s)) if (!allowed.has(id)) next = removePlayer(next, id);
  return next;
}

export interface LineupIssue {
  code: "unknown_player" | "duplicate" | "too_many_starters" | "no_goalkeeper" | "incomplete" | "unavailable" | "no_response";
  message: string;
  playerId?: string;
}

export function validateLineup(
  s: LineupState,
  ctx: { activeIds: Set<string>; names: Map<string, string>; availability: Map<string, AvailabilityState> },
): { errors: LineupIssue[]; warnings: LineupIssue[] } {
  const errors: LineupIssue[] = [];
  const warnings: LineupIssue[] = [];
  const nameOf = (id: string) => ctx.names.get(id) ?? "Unknown player";

  const all = playerIds(s);
  const seen = new Set<string>();
  for (const id of all) {
    if (seen.has(id)) errors.push({ code: "duplicate", message: `${nameOf(id)} is in the lineup twice.`, playerId: id });
    seen.add(id);
    if (!ctx.activeIds.has(id)) errors.push({ code: "unknown_player", message: `${nameOf(id)} is no longer in the squad.`, playerId: id });
  }

  const starters = Object.values(s.slots);
  if (starters.length > 11) errors.push({ code: "too_many_starters", message: "A team starts with 11 players at most." });

  const gk = slotsOf(s).find((x) => x.role === "GK");
  if (gk && !s.slots[gk.id]) warnings.push({ code: "no_goalkeeper", message: "Nobody is in goal." });
  if (starters.length < 11) warnings.push({ code: "incomplete", message: `Only ${starters.length} of 11 starters picked.` });

  for (const id of new Set(all)) {
    const a = ctx.availability.get(id) ?? "none";
    if (a === "no") warnings.push({ code: "unavailable", message: `${nameOf(id)} said they can't play.`, playerId: id });
    else if (a === "none") warnings.push({ code: "no_response", message: `${nameOf(id)} hasn't answered yet.`, playerId: id });
  }
  return { errors, warnings };
}
