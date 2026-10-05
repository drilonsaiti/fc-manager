"use client";
import { BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMatches, usePlayers, useSeasonStats } from "@/hooks/data";
import { buildSeasonTable, buildTeamSummary } from "@/features/stats/aggregate";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoader } from "@/components/ui/LoadingSpinner";

export default function StatsPage() {
  const { team, season, seasons, setSeasonId } = useAuth();
  const { matches, loading: lm } = useMatches(team?.id, season?.id);
  const { players, loading: lp } = usePlayers(team?.id);
  const { data, loading: ls } = useSeasonStats(team?.id, season?.id);

  if (lm || lp || ls) return <PageLoader />;

  const team_ = buildTeamSummary(matches);
  const rows = buildSeasonTable({
    players, stats: data?.stats ?? [], attended: data?.training.attended ?? new Map(),
    trainingsHeld: data?.training.held ?? 0, matchesPlayed: team_.played,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl tracking-wide">STATS</h1>
        {seasons.length > 1 && (
          <select className="input-field !w-auto !py-2" aria-label="Season" value={season?.id} onChange={(e) => setSeasonId(e.target.value)}>
            {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {team_.played === 0 && (rows.every((r) => r.trainingsAttended === 0)) ? (
        <EmptyState icon={BarChart3} title="No numbers yet" description="Stats appear after you finish a match on matchday." />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[["P", team_.played], ["W", team_.wins], ["D", team_.draws], ["L", team_.losses]].map(([l, v]) => (
              <div key={l} className="surface-2 p-3"><p className="text-2xl font-semibold tabular-nums">{v}</p><p className="text-xs text-pitch-400">{l}</p></div>
            ))}
          </div>
          <p className="text-sm text-pitch-300 tabular-nums">Goals {team_.goalsFor}:{team_.goalsAgainst} · {team_.points} pts</p>

          <div className="surface overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead className="text-xs text-pitch-500">
                <tr className="text-right">
                  <th className="text-left p-3 font-normal">Player</th>
                  <th className="p-2 font-normal" title="Appearances">App</th>
                  <th className="p-2 font-normal" title="Minutes">Min</th>
                  <th className="p-2 font-normal" title="Goals">G</th>
                  <th className="p-2 font-normal" title="Assists">A</th>
                  <th className="p-2 font-normal" title="Yellow cards">🟨</th>
                  <th className="p-2 font-normal" title="Red cards">🟥</th>
                  <th className="p-3 font-normal" title="Training attendance">Train</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((r) => (
                  <tr key={r.playerId} className="text-right tabular-nums">
                    <td className="text-left p-3 truncate max-w-[10rem]">{r.name}{!r.active && <span className="text-pitch-500 text-xs"> (archived)</span>}</td>
                    <td className="p-2">{r.appearances}</td><td className="p-2">{r.minutes}</td>
                    <td className="p-2 font-semibold">{r.goals}</td><td className="p-2">{r.assists}</td>
                    <td className="p-2">{r.yellow}</td><td className="p-2">{r.red}</td>
                    <td className="p-3 text-pitch-300">{r.attendancePct == null ? "–" : `${r.attendancePct}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-pitch-500">Only finished matches count. Own goals count for the other side.</p>
        </>
      )}
    </div>
  );
}
