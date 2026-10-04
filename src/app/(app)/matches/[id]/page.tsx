"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { getMatch, deleteMatch, getTeamStats } from "@/lib/firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers } from "@/hooks/usePlayers";
import { useAvailability } from "@/hooks/useAvailability";
import { suggestBestXI } from "@/lib/utils/aiLineup";
import { AvailabilityList } from "@/components/matches/AvailabilityList";
import { MatchForm } from "@/components/matches/MatchForm";
import { SquadSelector } from "@/components/lineup/SquadSelector";
import { Modal } from "@/components/ui/Modal";
import { PageLoader } from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";
import { ArrowLeft, MapPin, Clock, Edit3, Trash2, Wand2, Calendar } from "lucide-react";
import type { Match, PlayerStat } from "@/types";

type Tab = "availability" | "squad";

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, canManage } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("availability");
  const [showEdit, setShowEdit] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [allStats, setAllStats] = useState<PlayerStat[]>([]);

  const { players } = usePlayers(user?.teamId);
  const { summary, availabilities } = useAvailability(id);

  useEffect(() => {
    if (!id) return;
    getMatch(id).then((m) => { setMatch(m); setLoading(false); });
  }, [id]);

  useEffect(() => {
    if (user?.teamId) getTeamStats(user.teamId).then(setAllStats);
  }, [user?.teamId]);

  if (loading) return <PageLoader />;
  if (!match) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <p className="text-pitch-500">Match not found.</p>
      <button onClick={() => router.back()} className="btn-ghost">Go back</button>
    </div>
  );

  const handleDelete = async () => {
    if (!confirm("Delete this match? This cannot be undone.")) return;
    await deleteMatch(match.id);
    router.push("/matches");
  };

  const aiSuggestion = suggestBestXI(players, availabilities, allStats);

  const competitionLabel: Record<string, string> = {
    league: "League", cup: "Cup", friendly: "Friendly", tournament: "Tournament",
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl mx-auto w-full">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-pitch-500 hover:text-white transition-colors text-sm">
        <ArrowLeft className="w-4 h-4" /> All Matches
      </button>

      <div className="surface p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant={match.status === "upcoming" ? "upcoming" : "finished"}>{match.status}</Badge>
              <span className="text-xs text-pitch-500">{competitionLabel[match.competition]}</span>
              <span className="text-xs text-pitch-600">{match.isHome ? "HOME" : "AWAY"}</span>
            </div>
            <h1 className="text-2xl font-display text-white tracking-wide">vs {match.opponent}</h1>
          </div>
          {match.status === "finished" && match.homeScore != null && (
            <div className="text-center flex-shrink-0">
              <p className="font-display text-4xl text-white tracking-widest">{match.homeScore}–{match.awayScore}</p>
              <p className="text-xs text-pitch-600 mt-0.5">Final Score</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <span className="flex items-center gap-1.5 text-sm text-pitch-400"><Calendar className="w-4 h-4" />{format(match.date, "EEEE, dd MMMM yyyy")}</span>
          <span className="flex items-center gap-1.5 text-sm text-pitch-400"><Clock className="w-4 h-4" />{format(match.date, "HH:mm")}</span>
          <span className="flex items-center gap-1.5 text-sm text-pitch-400"><MapPin className="w-4 h-4" />{match.location}</span>
        </div>

        {match.notes && <p className="text-pitch-500 text-sm border-t border-pitch-800 pt-3">{match.notes}</p>}

        {canManage && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-pitch-800">
            <button onClick={() => setShowEdit(true)} className="btn-ghost text-sm flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5" /> Edit
            </button>
            <button onClick={() => setShowAI(true)} className="btn-ghost text-sm flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5" /> AI Best XI
            </button>
            <button onClick={handleDelete} className="btn-ghost text-sm flex items-center gap-1.5 text-red-500 hover:text-red-400 hover:bg-red-500/10">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Available",   count: summary.yes.length,   color: "text-green-400", border: "border-green-500/20" },
          { label: "Unavailable", count: summary.no.length,    color: "text-red-400",   border: "border-red-500/20" },
          { label: "Maybe",       count: summary.maybe.length, color: "text-amber-400", border: "border-amber-500/20" },
        ].map(({ label, count, color, border }) => (
          <div key={label} className={cn("surface p-3 text-center border", border)}>
            <p className={cn("text-2xl font-display tracking-wider", color)}>{count}</p>
            <p className="text-xs text-pitch-500">{label}</p>
          </div>
        ))}
      </div>

      {canManage && (
        <div className="flex border border-pitch-800 rounded-lg overflow-hidden p-1 gap-1">
          {(["availability","squad"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("flex-1 py-2 rounded-md text-sm font-medium transition-all capitalize",
                tab === t ? "bg-white text-black" : "text-pitch-400 hover:text-white")}>
              {t}
            </button>
          ))}
        </div>
      )}

      {tab === "availability" && <AvailabilityList matchId={id} />}
      {tab === "squad" && canManage && user?.teamId && (
        <SquadSelector matchId={id} teamId={user.teamId} players={players} />
      )}

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Match">
        <MatchForm existing={match} onSuccess={() => { setShowEdit(false); getMatch(id).then(setMatch); }} />
      </Modal>

      <Modal open={showAI} onClose={() => setShowAI(false)} title="AI Best XI Suggestion">
        <div className="space-y-3">
          <p className="text-pitch-500 text-sm">Based on availability, goals, assists and appearances:</p>
          {aiSuggestion.length === 0 ? (
            <p className="text-pitch-600 text-sm text-center py-4">No available players to suggest from.</p>
          ) : aiSuggestion.map(({ player, score, reason }, i) => (
            <div key={player.id} className="flex items-center gap-3 surface p-3">
              <span className="font-display text-2xl text-pitch-600 w-7 text-center">{i + 1}</span>
              <div className="w-9 h-9 rounded-full bg-pitch-800 flex items-center justify-center text-sm text-pitch-300 flex-shrink-0 overflow-hidden">
                {player.photoURL ? <img src={player.photoURL} alt="" className="w-full h-full object-cover" /> : player.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">{player.name}</p>
                <p className="text-pitch-500 text-xs truncate">{player.position ?? "—"} · {reason}</p>
              </div>
              <span className="text-pitch-600 font-mono text-xs">{score.toFixed(0)}pts</span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
