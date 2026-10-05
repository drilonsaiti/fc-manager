"use client";
import { useState } from "react";
import { ChevronDown, Dumbbell, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers, useTrainings } from "@/hooks/data";
import { createTraining, deleteTraining, updateTraining } from "@/lib/db/trainings";
import { friendlyError } from "@/lib/db/util";
import { AvailabilityPanel } from "@/components/availability/AvailabilityPanel";
import { TrainingForm } from "@/components/forms/TrainingForm";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/LoadingSpinner";
import { shortDate } from "@/lib/utils/datetime";
import { cn } from "@/lib/utils/cn";
import { trDyn, useT } from "@/i18n";
import type { Training } from "@/types";

export default function TrainingsPage() {
  const { t } = useT();
  const { team, season, canManage } = useAuth();
  const { trainings, loading, mutate } = useTrainings(team?.id, season?.id);
  const { players } = usePlayers(team?.id);
  const [editing, setEditing] = useState<Training | "new" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [now] = useState(() => Date.now());

  if (loading) return <ListSkeleton />;
  const sorted = trainings.slice().sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const upcoming = sorted.filter((x) => x.startsAt.getTime() >= now - 3 * 3600_000);
  const past = sorted.filter((x) => x.startsAt.getTime() < now - 3 * 3600_000).reverse();

  async function remove(tr: Training) {
    if (!confirm(t("tr.confirmDelete"))) return;
    try { await deleteTraining(tr.id); setOpenId(null); await mutate(); } catch (e) { setError(friendlyError(e)); }
  }

  const renderItem = (tr: Training, past: boolean) => (
    <li key={tr.id} className="surface">
      <button className="w-full flex items-center gap-3 p-4 text-left" aria-expanded={openId === tr.id}
        onClick={() => setOpenId(openId === tr.id ? null : tr.id)}>
        <div className="flex-1 min-w-0">
          <p className="font-medium">{shortDate(tr.startsAt)}</p>
          <p className="text-xs text-pitch-400 mt-0.5">{[tr.kind ? trDyn(`kind.${tr.kind}`, tr.kind) : "", tr.location].filter(Boolean).join(" · ") || t("tr.single")}</p>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-pitch-500 transition-transform", openId === tr.id && "rotate-180")} />
      </button>
      {openId === tr.id && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-4">
          <AvailabilityPanel kind="training" eventId={tr.id} title={t("tr.single")} startsAt={tr.startsAt} place={tr.location}
            shareToken={tr.shareToken} responsesOpen={tr.responsesOpen} players={players} onOpenChange={() => mutate()} showAttendance={past || tr.startsAt.getTime() < now} />
          {canManage && (
            <div className="flex gap-2">
              <button className="btn-ghost flex items-center gap-1.5" onClick={() => setEditing(tr)}><Pencil className="w-4 h-4" />{t("c.edit")}</button>
              <button className="btn-ghost flex items-center gap-1.5 text-red-400" onClick={() => remove(tr)}><Trash2 className="w-4 h-4" />{t("c.delete")}</button>
            </div>
          )}
        </div>
      )}
    </li>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-wide">{t("tr.title")}</h1>
        {canManage && <button className="btn-primary flex items-center gap-1.5" onClick={() => setEditing("new")}><Plus className="w-4 h-4" />{t("tr.new")}</button>}
      </div>
      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
      {trainings.length === 0 && (
        <EmptyState icon={Dumbbell} title={t("tr.empty")} description={t("tr.emptyHelp")}
          action={canManage ? <button className="btn-primary" onClick={() => setEditing("new")}>{t("tr.addOne")}</button> : undefined} />
      )}
      {upcoming.length > 0 && <section className="space-y-2"><h2 className="text-xs uppercase tracking-widest text-pitch-500">{t("tr.upcoming")}</h2><ul className="space-y-2">{upcoming.map((x) => renderItem(x, false))}</ul></section>}
      {past.length > 0 && <section className="space-y-2"><h2 className="text-xs uppercase tracking-widest text-pitch-500">{t("tr.past")}</h2><ul className="space-y-2">{past.map((x) => renderItem(x, true))}</ul></section>}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? t("tr.newTitle") : t("tr.editTitle")}>
        {editing && (
          <TrainingForm initial={editing === "new" ? undefined : editing} onCancel={() => setEditing(null)} onSubmit={async (input) => {
            if (!team) return;
            if (editing === "new") await createTraining(team.id, season?.id ?? null, input);
            else await updateTraining(editing.id, input);
            await mutate();
            setEditing(null);
          }} />
        )}
      </Modal>
    </div>
  );
}
