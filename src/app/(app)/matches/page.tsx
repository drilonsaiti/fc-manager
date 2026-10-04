"use client";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMatches } from "@/hooks/useMatches";
import { useAvailability } from "@/hooks/useAvailability";
import { MatchCard } from "@/components/matches/MatchCard";
import { MatchForm } from "@/components/matches/MatchForm";
import { Modal } from "@/components/ui/Modal";
import { PageLoader } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils/cn";
import { Plus, Calendar } from "lucide-react";
import type { Match } from "@/types";

type Tab = "upcoming" | "finished";

function MatchWithAvail({ match }: { match: Match }) {
  const { summary } = useAvailability(match.id);
  return <MatchCard match={match} availabilityCount={{ yes: summary.yes.length, total: summary.total }} />;
}

export default function MatchesPage() {
  const { user, canManage } = useAuth();
  const { upcomingMatches, finishedMatches, loading } = useMatches(user?.teamId);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [showForm, setShowForm] = useState(false);

  if (loading) return <PageLoader />;
  const displayed = tab === "upcoming" ? upcomingMatches : finishedMatches;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-white tracking-wide">MATCHES</h1>
          <p className="text-pitch-500 text-sm mt-0.5">{upcomingMatches.length} upcoming · {finishedMatches.length} played</p>
        </div>
        {canManage && (
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus className="w-4 h-4" /> Schedule
          </button>
        )}
      </div>

      <div className="flex border border-pitch-800 rounded-lg overflow-hidden p-1 gap-1 w-fit">
        {(["upcoming","finished"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-4 py-2 rounded-md text-sm font-medium transition-all capitalize",
              tab === t ? "bg-white text-black" : "text-pitch-400 hover:text-white")}>
            {t} ({t === "upcoming" ? upcomingMatches.length : finishedMatches.length})
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <EmptyState icon={Calendar}
          title={tab === "upcoming" ? "No upcoming matches" : "No matches played yet"}
          description={tab === "upcoming" && canManage ? "Schedule your first match to get started." : undefined}
          action={canManage && tab === "upcoming"
            ? <button onClick={() => setShowForm(true)} className="btn-primary text-sm">Schedule Match</button>
            : undefined}
        />
      ) : (
        <div className="space-y-3">
          {displayed.map((m) => <MatchWithAvail key={m.id} match={m} />)}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Schedule Match">
        <MatchForm onSuccess={() => setShowForm(false)} />
      </Modal>
    </div>
  );
}
