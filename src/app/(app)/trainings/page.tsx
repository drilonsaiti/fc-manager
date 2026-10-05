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
import { PageLoader } from "@/components/ui/LoadingSpinner";
import { shortDate } from "@/lib/utils/datetime";
import { cn } from "@/lib/utils/cn";
import type { Training } from "@/types";

export default function TrainingsPage() {
  const { team, season, canManage } = useAuth();
  const { trainings, loading, mutate } = useTrainings(team?.id, season?.id);
  const { players } = usePlayers(team?.id);
  const [editing, setEditing] = useState<Training | "new" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [now] = useState(() => Date.now());

  if (loading) return <PageLoader />;
  const sorted = trainings.slice().sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const upcoming = sorted.filter((t) => t.startsAt.getTime() >= now - 3 * 3600_000);
  const past = sorted.filter((t) => t.startsAt.getTime() < now - 3 * 3600_000).reverse();

  async function remove(t: Training) {
    if (!confirm("Delete this training and its attendance?")) return;
    try { await deleteTraining(t.id); setOpenId(null); await mutate(); } catch (e) { setError(friendlyError(e)); }
  }

  const renderItem = (t: Training, past: boolean) => (
    <li key={t.id} className="surface">
      <button className="w-full flex items-center gap-3 p-4 text-left" aria-expanded={openId === t.id}
        onClick={() => setOpenId(openId === t.id ? null : t.id)}>
        <div className="flex-1 min-w-0">
          <p className="font-medium">{shortDate(t.startsAt)}</p>
          <p className="text-xs text-pitch-400 mt-0.5">{[t.kind?.replace("_", " "), t.location].filter(Boolean).join(" · ") || "Training"}</p>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-pitch-500 transition-transform", openId === t.id && "rotate-180")} />
      </button>
      {openId === t.id && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-4">
          <AvailabilityPanel kind="training" eventId={t.id} title="Training" startsAt={t.startsAt} place={t.location}
            shareToken={t.shareToken} responsesOpen={t.responsesOpen} players={players} onOpenChange={() => mutate()} showAttendance={past || t.startsAt.getTime() < now} />
          {canManage && (
            <div className="flex gap-2">
              <button className="btn-ghost flex items-center gap-1.5" onClick={() => setEditing(t)}><Pencil className="w-4 h-4" />Edit</button>
              <button className="btn-ghost flex items-center gap-1.5 text-red-400" onClick={() => remove(t)}><Trash2 className="w-4 h-4" />Delete</button>
            </div>
          )}
        </div>
      )}
    </li>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-wide">TRAINING</h1>
        {canManage && <button className="btn-primary flex items-center gap-1.5" onClick={() => setEditing("new")}><Plus className="w-4 h-4" />New session</button>}
      </div>
      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
      {trainings.length === 0 && (
        <EmptyState icon={Dumbbell} title="No training sessions" description="Add a session and share the link — players tap Coming / Can't."
          action={canManage ? <button className="btn-primary" onClick={() => setEditing("new")}>Add a session</button> : undefined} />
      )}
      {upcoming.length > 0 && <section className="space-y-2"><h2 className="text-xs uppercase tracking-widest text-pitch-500">Upcoming</h2><ul className="space-y-2">{upcoming.map((t) => renderItem(t, false))}</ul></section>}
      {past.length > 0 && <section className="space-y-2"><h2 className="text-xs uppercase tracking-widest text-pitch-500">Past</h2><ul className="space-y-2">{past.map((t) => renderItem(t, true))}</ul></section>}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New training" : "Edit training"}>
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
