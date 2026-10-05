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
import { ListSkeleton } from "@/components/ui/LoadingSpinner";
import { useT } from "@/i18n";

export default function MatchesPage() {
  const { team, season, canManage } = useAuth();
  const { matches, loading, mutate } = useMatches(team?.id, season?.id);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { t } = useT();

  if (loading) return <ListSkeleton />;
  const upcoming = matches.filter((m) => m.status === "scheduled" || m.status === "live").sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());
  const past = matches.filter((m) => m.status === "final" || m.status === "cancelled");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-wide">{t("m.title")}</h1>
        {canManage && <button className="btn-primary flex items-center gap-1.5" onClick={() => setOpen(true)}><Plus className="w-4 h-4" />{t("m.new")}</button>}
      </div>

      {matches.length === 0 && (
        <EmptyState icon={CalendarDays} title={t("m.empty")} description={t("m.emptyHelp")}
          action={canManage ? <button className="btn-primary" onClick={() => setOpen(true)}>{t("m.addOne")}</button> : undefined} />
      )}

      {upcoming.length > 0 && (
        <section className="space-y-2"><h2 className="text-xs uppercase tracking-widest text-pitch-500">{t("m.upcoming")}</h2>
          {upcoming.map((m) => <MatchRow key={m.id} match={m} />)}</section>
      )}
      {past.length > 0 && (
        <section className="space-y-2"><h2 className="text-xs uppercase tracking-widest text-pitch-500">{t("m.played")}</h2>
          {past.map((m) => <MatchRow key={m.id} match={m} />)}</section>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t("m.newTitle")}>
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
