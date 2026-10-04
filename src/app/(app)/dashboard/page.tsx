"use client";
import { useAuth } from "@/contexts/AuthContext";
import { useMatches } from "@/hooks/useMatches";
import { usePlayers } from "@/hooks/usePlayers";
import { useAvailability } from "@/hooks/useAvailability";
import { useTrainings } from "@/hooks/useTrainings";
import { NextMatchWidget } from "@/components/dashboard/NextMatchWidget";
import { MatchCard } from "@/components/matches/MatchCard";
import { StatsCard } from "@/components/ui/StatsCard";
import { PageLoader } from "@/components/ui/LoadingSpinner";
import Link from "next/link";
import { Calendar, Users, Dumbbell, Plus, ArrowRight, Trophy } from "lucide-react";
import { format } from "date-fns";

function DashboardContent({ teamId }: { teamId: string }) {
  const { nextMatch, upcomingMatches, finishedMatches, loading: mLoading } = useMatches(teamId);
  const { allPlayers, loading: pLoading } = usePlayers(teamId);
  const { summary } = useAvailability(nextMatch?.id);
  const { upcoming: upcomingTrainings } = useTrainings(teamId);
  const { canManage } = useAuth();

  if (mLoading || pLoading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-white tracking-wide">DASHBOARD</h1>
          <p className="text-pitch-500 text-sm mt-0.5">{format(new Date(), "EEEE, dd MMMM yyyy")}</p>
        </div>
        {canManage && (
          <Link href="/matches" className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus className="w-4 h-4" /> New Match
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatsCard label="Players" value={allPlayers.length} icon={Users} />
        <StatsCard label="Upcoming" value={upcomingMatches.length} icon={Calendar} accent="blue" />
        <StatsCard label="Played" value={finishedMatches.length} icon={Trophy} accent="amber" />
        <StatsCard label="Training" value={upcomingTrainings.length} icon={Dumbbell} accent="green" />
      </div>

      {nextMatch ? (
        <NextMatchWidget match={nextMatch} availability={{
          yes: summary.yes.length, no: summary.no.length,
          maybe: summary.maybe.length, total: summary.total,
        }} />
      ) : (
        <div className="surface p-5 text-center">
          <p className="text-pitch-500 text-sm">No upcoming matches scheduled.</p>
          {canManage && <Link href="/matches" className="text-white text-sm underline mt-1 inline-block">Create one</Link>}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs text-pitch-500 uppercase tracking-wider font-medium">Recent Results</h2>
            <Link href="/matches" className="text-xs text-pitch-600 hover:text-white transition-colors flex items-center gap-1">All <ArrowRight className="w-3 h-3" /></Link>
          </div>
          {finishedMatches.slice(0, 3).length > 0
            ? finishedMatches.slice(0, 3).map((m) => <MatchCard key={m.id} match={m} />)
            : <div className="surface p-4 text-center"><p className="text-pitch-600 text-sm">No matches played yet.</p></div>}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs text-pitch-500 uppercase tracking-wider font-medium">Upcoming Training</h2>
            <Link href="/trainings" className="text-xs text-pitch-600 hover:text-white transition-colors flex items-center gap-1">All <ArrowRight className="w-3 h-3" /></Link>
          </div>
          {upcomingTrainings.slice(0, 3).length > 0
            ? upcomingTrainings.slice(0, 3).map((t) => (
              <Link key={t.id} href="/trainings" className="surface p-3 flex items-center gap-3 hover:border-pitch-600 transition-all">
                <div className="w-10 h-10 rounded-lg bg-pitch-800 flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-xs text-pitch-500 leading-none">{format(t.date, "MMM").toUpperCase()}</span>
                  <span className="text-white font-bold text-sm leading-tight">{format(t.date, "dd")}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{t.title}</p>
                  <p className="text-pitch-500 text-xs">{format(t.date, "HH:mm")} · {t.location}</p>
                </div>
              </Link>
            ))
            : <div className="surface p-4 text-center"><p className="text-pitch-600 text-sm">No training sessions scheduled.</p></div>}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs text-pitch-500 uppercase tracking-wider font-medium">Squad ({allPlayers.length})</h2>
          <Link href="/players" className="text-xs text-pitch-600 hover:text-white transition-colors flex items-center gap-1">Manage <ArrowRight className="w-3 h-3" /></Link>
        </div>
        <div className="surface p-3 flex flex-wrap gap-2">
          {allPlayers.slice(0, 18).map((p) => (
            <div key={p.id} title={`${p.name}${p.position ? ` · ${p.position}` : ""}`}
              className="w-9 h-9 rounded-full bg-pitch-800 border border-pitch-700 flex items-center justify-center overflow-hidden">
              {p.photoURL
                ? <img src={p.photoURL} alt={p.name} className="w-full h-full object-cover" />
                : <span className="text-xs font-medium text-pitch-300">{p.name.charAt(0).toUpperCase()}</span>}
            </div>
          ))}
          {allPlayers.length > 18 && (
            <div className="w-9 h-9 rounded-full bg-pitch-800 flex items-center justify-center">
              <span className="text-xs text-pitch-500">+{allPlayers.length - 18}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user?.teamId) return <PageLoader />;
  return <DashboardContent teamId={user.teamId} />;
}
