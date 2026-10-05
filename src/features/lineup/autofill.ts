import type { AvailabilityState, SeasonPlayerStat } from "@/types";
import type { FormationSlot, SlotRole } from "./formations";
import { benchPlayer, placePlayer, slotOfPlayer, type LineupState } from "./lineup";
import { getFormation } from "./formations";

/**
 * "Auto-fill": a transparent rule-based picker (no AI service, nothing leaves the app).
 * For every empty spot it scores each available player and solves the whole assignment at once
 * (Hungarian algorithm), so the best striker is not wasted on the wing just because the wing was filled first.
 *
 *   score = how well the player's positions fit the spot (0–100)
 *         + a small form bonus from goals/assists this season (up to ~12)
 *         + a small reliability bonus for regular starters (up to ~6)
 *         − a penalty if they only answered "maybe" (15) or haven't answered at all (25)
 *
 * Players who said they can't play are never picked. Players you already placed stay where they are.
 */

interface PosInfo { role: SlotRole; labels: string[] }

export const POSITION_INFO: Record<string, PosInfo> = {
  Goalkeeper: { role: "GK", labels: ["GK"] },
  "Right Back": { role: "DEF", labels: ["RB", "RWB"] },
  "Centre Back": { role: "DEF", labels: ["CB"] },
  "Left Back": { role: "DEF", labels: ["LB", "LWB"] },
  "Defensive Midfielder": { role: "MID", labels: ["DM"] },
  "Central Midfielder": { role: "MID", labels: ["CM", "M"] },
  "Attacking Midfielder": { role: "MID", labels: ["AM"] },
  "Right Winger": { role: "FWD", labels: ["RW", "RM"] },
  "Left Winger": { role: "FWD", labels: ["LW", "LM"] },
  Striker: { role: "FWD", labels: ["ST"] },
  "Second Striker": { role: "FWD", labels: ["ST", "AM"] },
};

const NEXT_TO: Record<SlotRole, SlotRole[]> = { GK: [], DEF: ["MID"], MID: ["DEF", "FWD"], FWD: ["MID"] };
const SECONDARY_WEIGHT = 0.92;
const NEUTRAL = 35;
const AVAILABILITY_PENALTY: Record<AvailabilityState, number> = { yes: 0, maybe: 15, none: 25, no: Infinity };

/** How well someone with these positions (main one first) suits a spot: 0 (never) to 100 (natural). */
export function positionFit(positions: string[], slot: Pick<FormationSlot, "role" | "label">): number {
  const known = positions.map((p) => POSITION_INFO[p]).filter((x): x is PosInfo => !!x);
  if (slot.role === "GK") return known.some((k) => k.role === "GK") ? 100 : 0;
  if (known.length === 0) return NEUTRAL;
  // A keeper whose main position is goalkeeper is not an outfield option.
  if (known[0].role === "GK" && known.length === 1) return 0;
  let best = 0;
  known.forEach((k, i) => {
    if (k.role === "GK") return;
    const base = k.labels.includes(slot.label) ? 100 : k.role === slot.role ? 62 : NEXT_TO[slot.role].includes(k.role) ? 30 : 8;
    best = Math.max(best, base * (i === 0 ? 1 : SECONDARY_WEIGHT));
  });
  return best;
}

/** Goals/assists this season matter most up front, less in midfield, hardly at the back. */
export function formBonus(stat: SeasonPlayerStat | undefined, role: SlotRole): number {
  if (!stat || stat.appearances === 0) return 0;
  const involvement = (stat.goals * 3 + stat.assists * 2) / stat.appearances;
  const weight = role === "FWD" ? 1 : role === "MID" ? 0.6 : role === "DEF" ? 0.2 : 0;
  return Math.min(1, involvement / 1.5) * 12 * weight;
}

export function reliabilityBonus(stat: SeasonPlayerStat | undefined, matchesPlayed: number): number {
  if (!stat || matchesPlayed === 0) return 0;
  return Math.min(1, stat.starts / matchesPlayed) * 6;
}

/** Minimum-cost assignment of rows to distinct columns (rows ≤ columns). Returns the column of each row. */
export function assign(cost: number[][]): number[] {
  const n = cost.length;
  const m = n === 0 ? 0 : cost[0].length;
  const u = Array<number>(n + 1).fill(0), v = Array<number>(m + 1).fill(0);
  const p = Array<number>(m + 1).fill(0), way = Array<number>(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = Array<number>(m + 1).fill(Infinity);
    const used = Array<boolean>(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity, j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const result = Array<number>(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) result[p[j] - 1] = j - 1;
  return result;
}

export interface AutoFillInput {
  players: { id: string; name: string; positions: string[]; active: boolean }[];
  availability: Map<string, AvailabilityState>;
  stats: SeasonPlayerStat[];
  matchesPlayed: number;
  /** How many substitutes to keep on the bench (default 7). */
  benchSize?: number;
}

export interface AutoFillResult {
  state: LineupState;
  /** Spots that were empty and are now filled. */
  filled: number;
  /** Spots still empty because not enough players are available. */
  missing: number;
  /** Players put somewhere that is not their position (fit below 50). */
  outOfPosition: { playerId: string; slotLabel: string }[];
  /** Players who have not said yes. */
  unsure: string[];
}

export function autoFill(start: LineupState, input: AutoFillInput): AutoFillResult {
  const formation = getFormation(start.formation);
  const empty = (formation?.slots ?? []).filter((s) => !start.slots[s.id]);
  const statBy = new Map(input.stats.map((s) => [s.playerId, s]));
  const placed = new Set(Object.values(start.slots));
  const answer = (id: string) => input.availability.get(id) ?? "none";

  const pool = input.players
    .filter((p) => p.active && !placed.has(p.id) && answer(p.id) !== "no")
    .sort((a, b) => a.name.localeCompare(b.name));

  const scoreOf = (p: (typeof pool)[number], slot: FormationSlot) =>
    positionFit(p.positions, slot) + formBonus(statBy.get(p.id), slot.role) +
    reliabilityBonus(statBy.get(p.id), input.matchesPlayed) - AVAILABILITY_PENALTY[answer(p.id)];

  let next = start;
  const outOfPosition: AutoFillResult["outOfPosition"] = [];
  const unsure: string[] = [];
  let filled = 0;

  if (empty.length > 0 && pool.length > 0) {
    // Pad with "nobody" columns so every spot has a column; a spot matched to nobody stays empty.
    const columns = Math.max(pool.length, empty.length);
    const NOBODY = 1e6;
    const cost = empty.map((slot) =>
      Array.from({ length: columns }, (_, j) => (j < pool.length ? -scoreOf(pool[j], slot) : NOBODY)));
    const picks = assign(cost);
    empty.forEach((slot, i) => {
      const player = pool[picks[i]];
      if (!player) return;
      next = placePlayer(next, slot.id, player.id);
      filled++;
      if (positionFit(player.positions, slot) < 50) outOfPosition.push({ playerId: player.id, slotLabel: slot.label });
      if (answer(player.id) !== "yes") unsure.push(player.id);
    });
  }

  // Bench: keep what the coach already chose, top up with the best remaining available players.
  const size = input.benchSize ?? 7;
  const startersNow = new Set(Object.values(next.slots));
  const benchNow = next.bench.filter((id) => !startersNow.has(id));
  // Confirmed players first, then "maybe", then those who have not answered; more appearances break ties.
  const rank = (id: string) => -AVAILABILITY_PENALTY[answer(id)] + (statBy.get(id)?.appearances ?? 0) * 0.01;
  const extras = pool
    .filter((p) => !startersNow.has(p.id) && !benchNow.includes(p.id))
    .sort((a, b) => rank(b.id) - rank(a.id) || a.name.localeCompare(b.name))
    .slice(0, Math.max(0, size - benchNow.length));
  for (const p of extras) if (slotOfPlayer(next, p.id) === null) next = benchPlayer(next, p.id);

  return { state: next, filled, missing: empty.length - filled, outOfPosition, unsure };
}
