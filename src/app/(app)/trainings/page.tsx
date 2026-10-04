"use client";
import { useState } from "react";
import { format, isPast } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useTrainings } from "@/hooks/useTrainings";
import { TrainingForm } from "@/components/trainings/TrainingForm";
import { TrainingAttendancePanel } from "@/components/trainings/TrainingAttendancePanel";
import { Modal } from "@/components/ui/Modal";
import { PageLoader } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils/cn";
import { Dumbbell, Plus, MapPin, Clock, ChevronDown, ChevronUp } from "lucide-react";
import type { Training } from "@/types";

function TrainingCard({ training }: { training: Training }) {
  const [expanded, setExpanded] = useState(false);
  const past = isPast(training.date);

  return (
    <div className={cn("surface overflow-hidden transition-all", expanded && "border-pitch-600")}>
      <button onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-start gap-3 hover:bg-pitch-800/40 transition-colors text-left">
        <div className={cn("w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0",
          past ? "bg-pitch-800" : "bg-white")}>
          <span className={cn("text-xs leading-none uppercase", past ? "text-pitch-500" : "text-pitch-700")}>{format(training.date, "MMM")}</span>
          <span className={cn("text-lg font-bold leading-tight", past ? "text-pitch-400" : "text-black")}>{format(training.date, "dd")}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-white font-medium">{training.title}</p>
              <div className="flex flex-wrap gap-3 mt-1">
                <span className="flex items-center gap-1 text-xs text-pitch-500"><Clock className="w-3 h-3" />{format(training.date, "HH:mm")}</span>
                <span className="flex items-center gap-1 text-xs text-pitch-500"><MapPin className="w-3 h-3" />{training.location}</span>
              </div>
            </div>
            {expanded ? <ChevronUp className="w-4 h-4 text-pitch-600 flex-shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-pitch-600 flex-shrink-0 mt-0.5" />}
          </div>
          {training.description && <p className="text-pitch-500 text-xs mt-1 line-clamp-1">{training.description}</p>}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-pitch-800 pt-4">
          <TrainingAttendancePanel trainingId={training.id} />
        </div>
      )}
    </div>
  );
}

export default function TrainingsPage() {
  const { user, canManage } = useAuth();
  const { upcoming, past, loading } = useTrainings(user?.teamId);
  const [showForm, setShowForm] = useState(false);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-white tracking-wide">TRAINING</h1>
          <p className="text-pitch-500 text-sm mt-0.5">{upcoming.length} upcoming · {past.length} completed</p>
        </div>
        {canManage && (
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus className="w-4 h-4" /> Add Session
          </button>
        )}
      </div>

      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs text-pitch-500 uppercase tracking-wider font-medium">Upcoming ({upcoming.length})</h2>
          {upcoming.map((t) => <TrainingCard key={t.id} training={t} />)}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs text-pitch-500 uppercase tracking-wider font-medium">Past Sessions ({past.length})</h2>
          {past.map((t) => <TrainingCard key={t.id} training={t} />)}
        </div>
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <EmptyState icon={Dumbbell} title="No training sessions yet"
          description={canManage ? "Schedule a training session to track attendance." : undefined}
          action={canManage ? <button onClick={() => setShowForm(true)} className="btn-primary text-sm">Add Session</button> : undefined}
        />
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Training Session">
        <TrainingForm onSuccess={() => setShowForm(false)} />
      </Modal>
    </div>
  );
}
