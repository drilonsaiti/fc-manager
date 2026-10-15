export type GameFormat = "11v11" | "9v9" | "7v7" | "6v6" | "5v5" | "4v4" | "futsal";

export interface FormatConfig {
  key: GameFormat;
  playersOnPitch: number;
  minSquad: number;
  maxSquad: number;
  defaultBenchSize: number;
  durationMinutes: number;
  formations: readonly string[];
}

/** Shared format catalog. Migration 0004 contains the matching database allowlist. */
export const FORMATS: Record<GameFormat, FormatConfig> = {
  "11v11": { key: "11v11", playersOnPitch: 11, minSquad: 11, maxSquad: 30, defaultBenchSize: 7, durationMinutes: 90,
    formations: ["4-4-2", "4-3-3", "4-2-3-1", "4-4-1-1", "3-5-2", "3-4-3", "5-3-2", "5-4-1", "4-5-1"] },
  "9v9": { key: "9v9", playersOnPitch: 9, minSquad: 9, maxSquad: 24, defaultBenchSize: 7, durationMinutes: 80,
    formations: ["3-3-2", "3-4-1", "4-3-1", "2-4-2", "2-3-3"] },
  "7v7": { key: "7v7", playersOnPitch: 7, minSquad: 7, maxSquad: 18, defaultBenchSize: 6, durationMinutes: 60,
    formations: ["2-3-1", "3-2-1", "3-1-2", "2-2-2"] },
  "6v6": { key: "6v6", playersOnPitch: 6, minSquad: 6, maxSquad: 16, defaultBenchSize: 5, durationMinutes: 50,
    formations: ["2-2-1", "3-1-1", "1-3-1"] },
  "5v5": { key: "5v5", playersOnPitch: 5, minSquad: 5, maxSquad: 14, defaultBenchSize: 4, durationMinutes: 40,
    formations: ["2-2", "1-2-1", "1-1-2"] },
  "4v4": { key: "4v4", playersOnPitch: 4, minSquad: 4, maxSquad: 12, defaultBenchSize: 3, durationMinutes: 40,
    formations: ["2-1", "1-2"] },
  futsal: { key: "futsal", playersOnPitch: 5, minSquad: 5, maxSquad: 14, defaultBenchSize: 4, durationMinutes: 40,
    formations: ["2-2", "1-2-1", "3-1"] },
};

export const FORMAT_KEYS = Object.keys(FORMATS) as GameFormat[];
export const isGameFormat = (value: unknown): value is GameFormat =>
  typeof value === "string" && Object.hasOwn(FORMATS, value);

export function formatConfig(format: GameFormat): FormatConfig { return FORMATS[format]; }
export function defaultFormation(format: GameFormat): string { return FORMATS[format].formations[0]; }
