import type { User, Availability, PlayerStat } from "@/types";

export function suggestBestXI(players: User[], availabilities: Availability[], allStats: PlayerStat[]) {
  const availableIds = new Set(availabilities.filter((a) => a.status === "yes").map((a) => a.userId));
  return players
    .filter((p) => availableIds.has(p.id))
    .map((player) => {
      const ps = allStats.filter((s) => s.userId === player.id);
      const goals = ps.reduce((s, x) => s + x.goals, 0);
      const assists = ps.reduce((s, x) => s + x.assists, 0);
      const matches = ps.length;
      const avgRating = ps.filter((s) => s.rating).length > 0
        ? ps.reduce((s, x) => s + (x.rating ?? 0), 0) / ps.filter((s) => s.rating).length
        : 5;
      const score = goals * 3 + assists * 2 + matches * 1 + avgRating * 0.5;
      const reasons = [];
      if (goals > 0) reasons.push(`${goals}G`);
      if (assists > 0) reasons.push(`${assists}A`);
      if (matches > 0) reasons.push(`${matches} apps`);
      return { player, score, reason: reasons.join(" · ") || "Available" };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 11);
}
