export type SlotRole = "GK" | "DEF" | "MID" | "FWD";

export interface FormationSlot {
  id: string;
  role: SlotRole;
  label: string;
  /** Percent of pitch width, 0 = left. */
  x: number;
  /** Percent of pitch height, 0 = opponent goal line (top), 100 = our goal line (bottom). */
  y: number;
}

export interface FormationDef { key: string; slots: FormationSlot[] }

/** Offered in the picker. Any other valid key (e.g. "4-1-4-1") works too — see parseFormation. */
export const PRESET_FORMATIONS = [
  "4-4-2", "4-3-3", "4-2-3-1", "4-4-1-1", "3-5-2", "3-4-3", "5-3-2", "5-4-1", "4-5-1",
] as const;

export const DEFAULT_FORMATION = "4-4-2";

/** "4-3-3" → [4, 3, 3]. Needs 2–5 lines of 1–6 players totalling 10 outfield players. */
export function parseFormation(key: string): number[] | null {
  if (!/^\d(-\d){1,4}$/.test(key)) return null;
  const lines = key.split("-").map(Number);
  if (lines.some((n) => n < 1 || n > 6)) return null;
  if (lines.reduce((a, b) => a + b, 0) !== 10) return null;
  return lines;
}

const HALF_WIDTH = [0, 0, 16, 30, 36, 38, 40];

function spread(count: number): number[] {
  if (count === 1) return [50];
  const w = HALF_WIDTH[count] ?? 40;
  return Array.from({ length: count }, (_, j) => Math.round((50 + w * ((2 * j) / (count - 1) - 1)) * 100) / 100);
}

function labels(role: SlotRole, count: number, midIndex: number, midLines: number): string[] {
  if (role === "DEF") {
    return ({ 2: ["CB", "CB"], 3: ["CB", "CB", "CB"], 4: ["LB", "CB", "CB", "RB"], 5: ["LWB", "CB", "CB", "CB", "RWB"] } as Record<number, string[]>)[count]
      ?? Array(count).fill("D");
  }
  if (role === "FWD") {
    return ({ 1: ["ST"], 2: ["ST", "ST"], 3: ["LW", "ST", "RW"] } as Record<number, string[]>)[count] ?? Array(count).fill("ST");
  }
  // midfield
  if (midLines > 1 && midIndex === 0 && count <= 3) return Array(count).fill("DM");
  if (midLines > 1 && midIndex > 0) {
    if (count === 3) return ["LW", "AM", "RW"];
    if (count <= 2) return Array(count).fill("AM");
  }
  return ({ 1: ["CM"], 2: ["CM", "CM"], 3: ["CM", "CM", "CM"], 4: ["LM", "CM", "CM", "RM"], 5: ["LM", "CM", "CM", "CM", "RM"] } as Record<number, string[]>)[count]
    ?? Array(count).fill("M");
}

export function buildFormation(key: string): FormationDef | null {
  const lines = parseFormation(key);
  if (!lines) return null;

  const slots: FormationSlot[] = [{ id: "GK", role: "GK", label: "GK", x: 50, y: 90 }];
  const midLines = lines.length - 2;
  lines.forEach((count, i) => {
    const role: SlotRole = i === 0 ? "DEF" : i === lines.length - 1 ? "FWD" : "MID";
    const y = Math.round((72 - i * (58 / (lines.length - 1))) * 100) / 100;
    const xs = spread(count);
    const names = labels(role, count, i - 1, midLines);
    xs.forEach((x, j) => slots.push({ id: `L${i}_${j}`, role, label: names[j], x, y }));
  });
  return { key, slots };
}

const cache = new Map<string, FormationDef>();

/** Returns the formation, or null when the key is not a valid formation. */
export function getFormation(key: string): FormationDef | null {
  const hit = cache.get(key);
  if (hit) return hit;
  const built = buildFormation(key);
  if (built) cache.set(key, built);
  return built;
}
