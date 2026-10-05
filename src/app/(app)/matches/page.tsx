"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMatches } from "@/hooks/data";
import { createMatch } from "@/lib/db/matches";
import { MatchForm } from "@/components/forms/MatchForm";
import { MatchRow } from "@/components/ui/MatchRow";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoader } from "@/components/ui/LoadingSpinner";

export default function MatchesPage() {
  const { team, season, canManage } = useAuth();
  const { matches, loading, mutate } = useMatches(team?.id, season?.id);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  if (loading) return <PageLoader />;
  const upcoming = matches.filter((m) => m.status === "scheduled" || m.status === "live").sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());
  const past = matches.filter((m) => m.status === "final" || m.status === "cancelled");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-wide">MATCHES</h1>
        {canManage && <button className="btn-primary flex items-center gap-1.5" onClick={() => setOpen(true)}><Plus className="w-4 h-4" />New match</button>}
      </div>

      {matches.length === 0 && (
        <EmptyState icon={CalendarDays} title="No matches yet" description="Add your next match, then share the availability link with your players."
          action={canManage ? <button className="btn-primary" onClick={() => setOpen(true)}>Add a match</button> : undefined} />
      )}

      {upcoming.length > 0 && (
        <section className="space-y-2"><h2 className="text-xs uppercase tracking-widest text-pitch-500">Upcoming</h2>
          {upcoming.map((m) => <MatchRow key={m.id} match={m} />)}</section>
      )}
      {past.length > 0 && (
        <section className="space-y-2"><h2 className="text-xs uppercase tracking-widest text-pitch-500">Played</h2>
          {past.map((m) => <MatchRow key={m.id} match={m} />)}</section>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New match">
        <MatchForm onCancel={() => setOpen(false)} onSubmit={async (input) => {
          if (!team) return;
          const id = await createMatch(team.id, season?.id ?? null, input);
          await mutate();
          router.push(`/matches/${id}`);
        }} />
      </Modal>
    </div>
  );
}
