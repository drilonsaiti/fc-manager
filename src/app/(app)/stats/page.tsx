"use client";
import { BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMatches, usePlayers, useSeasonStats } from "@/hooks/data";
import { buildSeasonTable, buildTeamSummary } from "@/features/stats/aggregate";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/LoadingSpinner";
import { useT } from "@/i18n";

export default function StatsPage() {
  const { t } = useT();
  const { team, season, seasons, setSeasonId } = useAuth();
  const { matches, loading: lm } = useMatches(team?.id, season?.id);
  const { players, loading: lp } = usePlayers(team?.id);
  const { data, loading: ls } = useSeasonStats(team?.id, season?.id);

  if (lm || lp || ls) return <ListSkeleton />;

  const team_ = buildTeamSummary(matches);
  const rows = buildSeasonTable({
    players, stats: data?.stats ?? [], attended: data?.training.attended ?? new Map(),
    trainingsHeld: data?.training.held ?? 0, matchesPlayed: team_.played,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl tracking-wide">{t("st.title")}</h1>
        {seasons.length > 1 && (
          <select className="input-field !w-auto !py-2" aria-label={t("st.season")} value={season?.id} onChange={(e) => setSeasonId(e.target.value)}>
            {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {team_.played === 0 && (rows.every((r) => r.trainingsAttended === 0)) ? (
        <EmptyState icon={BarChart3} title={t("st.empty")} description={t("st.emptyHelp")} />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2 text-center">
            {([[t("st.P"), team_.played], [t("st.W"), team_.wins], [t("st.D"), team_.draws], [t("st.L"), team_.losses]] as [string, number][]).map(([l, v]) => (
              <div key={l} className="surface-2 p-3"><p className="text-2xl font-semibold tabular-nums">{v}</p><p className="text-xs text-pitch-400">{l}</p></div>
            ))}
          </div>
          <p className="text-sm text-pitch-300 tabular-nums">{t("st.goalsLine", { gf: team_.goalsFor, ga: team_.goalsAgainst, pts: team_.points })}</p>

          <div className="surface overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead className="text-xs text-pitch-500">
                <tr className="text-right">
                  <th className="text-left p-3 font-normal">{t("st.player")}</th>
                  <th className="p-2 font-normal" title={t("st.appTip")}>{t("st.app")}</th>
                  <th className="p-2 font-normal" title={t("st.minTip")}>{t("st.min")}</th>
                  <th className="p-2 font-normal" title={t("st.gTip")}>{t("st.g")}</th>
                  <th className="p-2 font-normal" title={t("st.aTip")}>{t("st.a")}</th>
                  <th className="p-2 font-normal" title={t("st.yTip")}>🟨</th>
                  <th className="p-2 font-normal" title={t("st.rTip")}>🟥</th>
                  <th className="p-3 font-normal" title={t("st.trainTip")}>{t("st.train")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((r) => (
                  <tr key={r.playerId} className="text-right tabular-nums">
                    <td className="text-left p-3 truncate max-w-[10rem]">{r.name}{!r.active && <span className="text-pitch-500 text-xs"> {t("st.archived")}</span>}</td>
                    <td className="p-2">{r.appearances}</td><td className="p-2">{r.minutes}</td>
                    <td className="p-2 font-semibold">{r.goals}</td><td className="p-2">{r.assists}</td>
                    <td className="p-2">{r.yellow}</td><td className="p-2">{r.red}</td>
                    <td className="p-3 text-pitch-300">{r.attendancePct == null ? "–" : `${r.attendancePct}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-pitch-500">{t("st.footnote")}</p>
        </>
      )}
    </div>
  );
}
