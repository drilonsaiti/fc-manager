"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAvailability, useMatches, usePlayers, useTrainings } from "@/hooks/data";
import { buildTeamSummary, resultLetter } from "@/features/stats/aggregate";
import { AvailabilityPanel } from "@/components/availability/AvailabilityPanel";
import { MatchRow } from "@/components/ui/MatchRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/LoadingSpinner";
import { shortDate } from "@/lib/utils/datetime";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import type { Match, Player } from "@/types";

export default function DashboardPage() {
  const { t } = useT();
  const { team, season, canManage } = useAuth();
  const { matches, loading, mutate } = useMatches(team?.id, season?.id);
  const { players } = usePlayers(team?.id);
  const { trainings } = useTrainings(team?.id, season?.id);
  const [now] = useState(() => Date.now());

  if (loading) return <ListSkeleton />;
  const next = matches.filter((m) => m.status === "live" || (m.status === "scheduled" && m.kickoff.getTime() > now - 3 * 3600_000))
    .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime())[0];
  const nextTraining = trainings.filter((t) => t.startsAt.getTime() > now).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];
  const played = matches.filter((m) => m.status === "final");
  const form = played.slice(0, 5);
  const summary = buildTeamSummary(matches);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-wide">{team?.name}</h1>

      {next ? <NextMatch match={next} players={players} onChange={() => mutate()} /> : (
        <EmptyState icon={CalendarDays} title={t("dash.noUpcoming")}
          description={t("dash.noUpcomingHelp")}
          action={canManage ? <Link href="/matches" className="btn-primary inline-block">{t("m.addOne")}</Link> : undefined} />
      )}

      {nextTraining && (
        <Link href="/trainings" className="surface p-4 flex items-center gap-3">
          <div className="flex-1"><p className="text-xs text-pitch-500 uppercase tracking-widest">{t("dash.nextTraining")}</p>
            <p className="font-medium mt-0.5">{shortDate(nextTraining.startsAt)}</p></div>
          <ArrowRight className="w-4 h-4 text-pitch-500" />
        </Link>
      )}

      {summary.played > 0 && (
        <section className="surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-widest text-pitch-500">{t("dash.form")}</h2>
            <Link href="/stats" className="text-xs text-pitch-400 underline">{t("dash.allStats")}</Link>
          </div>
          <div className="flex gap-1.5">
            {form.map((m) => { const r = resultLetter(m); return (
              <span key={m.id} className={cn("w-8 h-8 rounded-md flex items-center justify-center text-sm font-semibold",
                r === "W" ? "bg-green-500/20 text-green-400" : r === "L" ? "bg-red-500/20 text-red-400" : "bg-white/10 text-pitch-200")}>{r === "W" ? t("st.W") : r === "D" ? t("st.D") : t("st.L")}</span>
            ); })}
          </div>
          <p className="text-sm text-pitch-300 tabular-nums">{t("dash.summary", { p: summary.played, w: summary.wins, d: summary.draws, l: summary.losses, gf: summary.goalsFor, ga: summary.goalsAgainst })}</p>
        </section>
      )}

      {played[0] && (<section className="space-y-2"><h2 className="text-xs uppercase tracking-widest text-pitch-500">{t("dash.lastResult")}</h2><MatchRow match={played[0]} /></section>)}
    </div>
  );
}

function NextMatch({ match, players, onChange }: { match: Match; players: Player[]; onChange: () => void }) {
  const { t } = useT();
  const { summary } = useAvailability("match", match.id, players);
  return (
    <section className="space-y-3">
      <Link href={`/matches/${match.id}`} className="surface p-4 block">
        <p className="text-xs text-pitch-500 uppercase tracking-widest">{match.status === "live" ? t("dash.liveNow") : t("dash.nextMatch")}</p>
        <p className="font-display text-3xl tracking-wide mt-1">{match.isHome ? t("m.vs") : t("m.at")} {match.opponent}</p>
        <p className="text-sm text-pitch-400">{shortDate(match.kickoff)}{match.venue ? ` · ${match.venue}` : ""}</p>
        <p className="text-sm text-pitch-300 mt-2 tabular-nums">{t("dash.counts", { yes: summary.yes.length, maybe: summary.maybe.length, none: summary.none.length })}</p>
      </Link>
      {match.status === "scheduled" && (
        <AvailabilityPanel kind="match" eventId={match.id} title={`${t("m.vs")} ${match.opponent}`} startsAt={match.kickoff} place={match.venue}
          shareToken={match.shareToken} responsesOpen={match.responsesOpen} players={players} onOpenChange={onChange} />
      )}
    </section>
  );
}
