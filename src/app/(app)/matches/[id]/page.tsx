"use client";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Megaphone, Pencil, Trash2, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAvailability, useMatch, usePlayers } from "@/hooks/data";
import { deleteMatch, setMatchStatus, updateMatch } from "@/lib/db/matches";
import { friendlyError } from "@/lib/db/util";
import { AvailabilityPanel } from "@/components/availability/AvailabilityPanel";
import { MatchForm } from "@/components/forms/MatchForm";
import { Modal } from "@/components/ui/Modal";
import { PostModal } from "@/components/social/PostModal";
import { PageLoader } from "@/components/ui/LoadingSpinner";
import { shortDate } from "@/lib/utils/datetime";
import { cn } from "@/lib/utils/cn";
import { useT, type MessageKey } from "@/i18n";
import type { AvailabilityState } from "@/types";

// Loaded on demand: the lineup builder, matchday and report are only needed once their tab is opened.
const Loading = () => <div className="h-64 rounded-xl bg-white/[0.04] animate-pulse" aria-busy="true" />;
const LineupBuilder = dynamic(() => import("@/components/lineup/LineupBuilder").then((m) => m.LineupBuilder), { loading: Loading });
const MatchdayPanel = dynamic(() => import("@/components/matchday/MatchdayPanel").then((m) => m.MatchdayPanel), { loading: Loading });
const ReportView = dynamic(() => import("@/components/report/ReportView").then((m) => m.ReportView), { loading: Loading });

type Tab = "availability" | "lineup" | "matchday" | "report";
const TABS: { id: Tab; label: MessageKey }[] = [
  { id: "availability", label: "tab.availability" }, { id: "lineup", label: "tab.lineup" },
  { id: "matchday", label: "tab.matchday" }, { id: "report", label: "tab.report" },
];

export default function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useT();
  const { team, canManage } = useAuth();
  const { match, loading, mutate } = useMatch(id);
  const { players } = usePlayers(team?.id);
  const { rows } = useAvailability("match", id, players);
  const [tab, setTab] = useState<Tab | null>(null);
  const [editing, setEditing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const availability = useMemo(() => new Map<string, AvailabilityState>(rows.map((r) => [r.player.id, r.status])), [rows]);

  if (loading) return <PageLoader />;
  if (!match || !team) return <p className="text-pitch-400">{t("m.notFound")} <Link className="underline" href="/matches">{t("m.backToMatches")}</Link></p>;

  // Sensible default tab for where the match is in its life.
  const current: Tab = tab ?? (match.status === "scheduled" ? "availability" : match.status === "live" ? "matchday" : "report");
  const run = async (fn: () => Promise<void>) => { setError(""); try { await fn(); } catch (e) { setError(friendlyError(e)); } };

  return (
    <div className="space-y-5">
      <Link href="/matches" className="inline-flex items-center gap-1.5 text-sm text-pitch-400 hover:text-white"><ArrowLeft className="w-4 h-4" />{t("m.backToMatches")}</Link>

      <header>
        <h1 className="font-display text-4xl tracking-wide">{match.isHome ? t("m.vs") : t("m.at")} {match.opponent}</h1>
        <p className="text-sm text-pitch-400">{shortDate(match.kickoff)}{match.venue ? ` · ${match.venue}` : ""}</p>
        {match.status === "cancelled" && <p className="text-sm text-red-400 mt-1">{t("m.cancelledNote")}</p>}
        {canManage && match.status !== "cancelled" && (
          <button className="btn-ghost flex items-center gap-1.5 mt-2 -ml-3" onClick={() => setPosting(true)}><Megaphone className="w-4 h-4" />{t("post.button")}</button>
        )}
        {canManage && match.status !== "live" && match.status !== "final" && (
          <div className="flex gap-1 mt-1 -ml-3">
            <button className="btn-ghost flex items-center gap-1.5" onClick={() => setEditing(true)}><Pencil className="w-4 h-4" />{t("c.edit")}</button>
            <button className="btn-ghost flex items-center gap-1.5" onClick={() => run(async () => { await setMatchStatus(match.id, match.status === "cancelled" ? "scheduled" : "cancelled"); await mutate(); })}>
              <XCircle className="w-4 h-4" />{match.status === "cancelled" ? t("m.reinstate") : t("m.cancelMatch")}
            </button>
            <button className="btn-ghost flex items-center gap-1.5 text-red-400" onClick={() => confirm(t("m.confirmDelete")) && run(async () => { await deleteMatch(match.id); router.replace("/matches"); })}>
              <Trash2 className="w-4 h-4" />{t("c.delete")}
            </button>
          </div>
        )}
        {error && <p role="alert" className="text-red-400 text-sm mt-2">{error}</p>}
      </header>

      <div role="tablist" className="grid grid-cols-4 gap-1 p-1 surface-2">
        {TABS.map((tb) => (
          <button key={tb.id} role="tab" aria-selected={current === tb.id} onClick={() => setTab(tb.id)}
            className={cn("py-2 rounded-lg text-xs font-medium transition-colors", current === tb.id ? "bg-white text-black" : "text-pitch-400 hover:text-white")}>
            {t(tb.label)}
          </button>
        ))}
      </div>

      {current === "availability" && (
        <AvailabilityPanel kind="match" eventId={match.id} title={`${t("m.vs")} ${match.opponent}`} startsAt={match.kickoff} place={match.venue}
          shareToken={match.shareToken} responsesOpen={match.responsesOpen} locked={match.status !== "scheduled"} players={players} onOpenChange={() => mutate()} />
      )}
      {current === "lineup" && <LineupBuilder key={match.id} match={match} teamName={team.name} players={players} availability={availability} readOnly={match.status === "final" || match.status === "cancelled"} />}
      {current === "matchday" && <MatchdayPanel match={match} players={players} onMatchChange={() => mutate()} />}
      {current === "report" && <ReportView match={match} players={players} teamName={team.name} onChange={() => mutate()} />}

      {posting && <PostModal match={match} players={players} teamName={team.name} onClose={() => setPosting(false)} />}

      <Modal open={editing} onClose={() => setEditing(false)} title={t("m.editTitle")}>
        <MatchForm initial={match} onCancel={() => setEditing(false)} onSubmit={async (input) => { await updateMatch(match.id, input); await mutate(); setEditing(false); }} />
      </Modal>
    </div>
  );
}
