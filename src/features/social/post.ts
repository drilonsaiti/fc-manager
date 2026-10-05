import type { Lineup } from "@/types";
import { fromEntries, startersOf } from "@/features/lineup/lineup";
import type { MatchReport } from "@/features/report/report";
import type { SlotRole } from "@/features/lineup/formations";

export type PostKind = "announce" | "lineup" | "result";

/** Every word the post prints, already in the chosen language. */
export interface PostLabels {
  matchday: string;
  cta: string;
  startingXI: string;
  bench: string;
  fullTime: string;
  win: string;
  draw: string;
  loss: string;
  goals: string;
  redCard: string;
  thanks: string;
  /** e.g. "#football" */
  tag: string;
  /** Short role names for the lineup: keeper, defenders, midfielders, forwards. */
  roles: Record<SlotRole, string>;
}

export const EN_POST_LABELS: PostLabels = {
  matchday: "MATCHDAY", cta: "Come and support us! 💪", startingXI: "STARTING XI", bench: "Bench",
  fullTime: "FULL TIME", win: "Victory! 🎉", draw: "A point each.", loss: "Not our day. We go again. 💪",
  goals: "Goals", redCard: "Red card", thanks: "Thank you for the support! 🙏", tag: "#football",
  roles: { GK: "GK", DEF: "DEF", MID: "MID", FWD: "FWD" },
};

/** "FC Test" → "#FCTest". Keeps letters and digits of any alphabet, drops the rest. */
export function teamTag(name: string): string {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const joined = words.map((w) => w.charAt(0).toLocaleUpperCase() + w.slice(1)).join("");
  return joined ? `#${joined}` : "";
}

const hashtags = (team: string, l: PostLabels) => [teamTag(team), l.tag].filter(Boolean).join(" ");

const versus = (r: MatchReport) => `${r.home.name} vs ${r.away.name}`;

export interface PostInput {
  teamName: string;
  report: MatchReport;
  lineup: Lineup | null;
  /** Announcement details. */
  when: string;
  venue: string;
  competition: string;
  labels?: PostLabels;
}

export function buildPost(kind: PostKind, input: PostInput): string {
  const l = input.labels ?? EN_POST_LABELS;
  const r = input.report;
  const tags = hashtags(input.teamName, l);
  const lines: string[] = [];

  if (kind === "announce") {
    lines.push(`⚽ ${l.matchday}`, versus(r), "");
    lines.push(`📅 ${input.when}`);
    if (input.venue) lines.push(`📍 ${input.venue}`);
    if (input.competition) lines.push(`🏆 ${input.competition}`);
    lines.push("", l.cta, "", tags);
  } else if (kind === "lineup") {
    lines.push(`📋 ${l.startingXI}${input.lineup ? ` · ${input.lineup.formation}` : ""}`, versus(r), "");
    if (input.lineup) {
      const state = fromEntries(input.lineup.formation, input.lineup.entries);
      const byRole = new Map<SlotRole, string[]>();
      // report.startingXI is built from the same startersOf() order, so index i matches slot i
      startersOf(state).forEach(({ slot }, i) => {
        const p = r.startingXI[i];
        if (!p) return;
        byRole.set(slot.role, [...(byRole.get(slot.role) ?? []), `${p.number != null ? `#${p.number} ` : ""}${p.name}`]);
      });
      for (const role of ["GK", "DEF", "MID", "FWD"] as SlotRole[]) {
        const names = byRole.get(role);
        if (names?.length) lines.push(`${l.roles[role]}: ${names.join(", ")}`);
      }
    }
    if (r.bench.length) lines.push("", `${l.bench}: ${r.bench.map((b) => b.name).join(", ")}`);
    lines.push("", l.cta, "", tags);
  } else {
    const headline = r.result === "Win" ? l.win : r.result === "Draw" ? l.draw : l.loss;
    lines.push(`🏁 ${l.fullTime}`, `${r.home.name} ${r.home.score} – ${r.away.score} ${r.away.name}`, headline);
    if (r.goals.length) lines.push("", `⚽ ${l.goals}`, ...r.goals.filter((g) => g.forTeam === "us").map((g) => `${g.minute}' ${g.text}`));
    const reds = r.cards.filter((c) => c.kind !== "yellow");
    if (reds.length) lines.push("", ...reds.map((c) => `🟥 ${c.player} ${c.minute}'`));
    lines.push("", l.thanks, "", tags);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
