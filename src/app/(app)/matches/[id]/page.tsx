"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAvailability, useMatch, usePlayers } from "@/hooks/data";
import { deleteMatch, setMatchStatus, updateMatch } from "@/lib/db/matches";
import { friendlyError } from "@/lib/db/util";
import { AvailabilityPanel } from "@/components/availability/AvailabilityPanel";
import { LineupBuilder } from "@/components/lineup/LineupBuilder";
import { MatchdayPanel } from "@/components/matchday/MatchdayPanel";
import { ReportView } from "@/components/report/ReportView";
import { MatchForm } from "@/components/forms/MatchForm";
import { Modal } from "@/components/ui/Modal";
import { PageLoader } from "@/components/ui/LoadingSpinner";
import { shortDate } from "@/lib/utils/datetime";
import { cn } from "@/lib/utils/cn";
import type { AvailabilityState } from "@/types";

type Tab = "availability" | "lineup" | "matchday" | "report";
const TABS: { id: Tab; label: string }[] = [
  { id: "availability", label: "Availability" }, { id: "lineup", label: "Lineup" },
  { id: "matchday", label: "Matchday" }, { id: "report", label: "Report" },
];

export default function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { team, canManage } = useAuth();
  const { match, loading, mutate } = useMatch(id);
  const { players } = usePlayers(team?.id);
  const { rows } = useAvailability("match", id, players);
  const [tab, setTab] = useState<Tab | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  const availability = useMemo(() => new Map<string, AvailabilityState>(rows.map((r) => [r.player.id, r.status])), [rows]);

  if (loading) return <PageLoader />;
  if (!match || !team) return <p className="text-pitch-400">Match not found. <Link className="underline" href="/matches">Back to matches</Link></p>;

  // Sensible default tab for where the match is in its life.
  const current: Tab = tab ?? (match.status === "scheduled" ? "availability" : match.status === "live" ? "matchday" : "report");
  const run = async (fn: () => Promise<void>) => { setError(""); try { await fn(); } catch (e) { setError(friendlyError(e)); } };

  return (
    <div className="space-y-5">
      <Link href="/matches" className="inline-flex items-center gap-1.5 text-sm text-pitch-400 hover:text-white"><ArrowLeft className="w-4 h-4" />Matches</Link>

      <header>
        <h1 className="font-display text-4xl tracking-wide">{match.isHome ? "vs" : "at"} {match.opponent}</h1>
        <p className="text-sm text-pitch-400">{shortDate(match.kickoff)}{match.venue ? ` · ${match.venue}` : ""}</p>
        {match.status === "cancelled" && <p className="text-sm text-red-400 mt-1">Cancelled</p>}
        {canManage && match.status !== "live" && match.status !== "final" && (
          <div className="flex gap-1 mt-2 -ml-3">
            <button className="btn-ghost flex items-center gap-1.5" onClick={() => setEditing(true)}><Pencil className="w-4 h-4" />Edit</button>
            <button className="btn-ghost flex items-center gap-1.5" onClick={() => run(async () => { await setMatchStatus(match.id, match.status === "cancelled" ? "scheduled" : "cancelled"); await mutate(); })}>
              <XCircle className="w-4 h-4" />{match.status === "cancelled" ? "Reinstate" : "Cancel match"}
            </button>
            <button className="btn-ghost flex items-center gap-1.5 text-red-400" onClick={() => confirm("Delete this match for good?") && run(async () => { await deleteMatch(match.id); router.replace("/matches"); })}>
              <Trash2 className="w-4 h-4" />Delete
            </button>
          </div>
        )}
        {error && <p role="alert" className="text-red-400 text-sm mt-2">{error}</p>}
      </header>

      <div role="tablist" className="grid grid-cols-4 gap-1 p-1 surface-2">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={current === t.id} onClick={() => setTab(t.id)}
            className={cn("py-2 rounded-lg text-xs font-medium transition-colors", current === t.id ? "bg-white text-black" : "text-pitch-400 hover:text-white")}>
            {t.label}
          </button>
        ))}
      </div>

      {current === "availability" && (
        <AvailabilityPanel kind="match" eventId={match.id} title={`vs ${match.opponent}`} startsAt={match.kickoff} place={match.venue}
          shareToken={match.shareToken} responsesOpen={match.responsesOpen} locked={match.status !== "scheduled"} players={players} onOpenChange={() => mutate()} />
      )}
      {current === "lineup" && <LineupBuilder key={match.id} matchId={match.id} players={players} availability={availability} readOnly={match.status === "final" || match.status === "cancelled"} />}
      {current === "matchday" && <MatchdayPanel match={match} players={players} onMatchChange={() => mutate()} />}
      {current === "report" && <ReportView match={match} players={players} teamName={team.name} onChange={() => mutate()} />}

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit match">
        <MatchForm initial={match} onCancel={() => setEditing(false)} onSubmit={async (input) => { await updateMatch(match.id, input); await mutate(); setEditing(false); }} />
      </Modal>
    </div>
  );
}
