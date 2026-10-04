"use client";
import { useEffect, useState } from "react";
import { subscribeToTrainingAttendance, setTrainingAttendance } from "@/lib/firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils/cn";
import { Check, X, HelpCircle } from "lucide-react";
import type { TrainingAttendance, AvailabilityStatus } from "@/types";

const CFG = [
  { s: "yes" as AvailabilityStatus,   Icon: Check,       label: "Going",    active: "border-green-500 bg-green-500/10 text-green-400" },
  { s: "no" as AvailabilityStatus,    Icon: X,           label: "Can't Go", active: "border-red-500 bg-red-500/10 text-red-400" },
  { s: "maybe" as AvailabilityStatus, Icon: HelpCircle,  label: "Maybe",    active: "border-amber-500 bg-amber-500/10 text-amber-400" },
];

export function TrainingAttendancePanel({ trainingId }: { trainingId: string }) {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<TrainingAttendance[]>([]);

  useEffect(() => {
    const unsub = subscribeToTrainingAttendance(trainingId, setAttendance);
    return () => unsub();
  }, [trainingId]);

  const myStatus = user ? attendance.find((a) => a.userId === user.id)?.status ?? null : null;

  const respond = async (status: AvailabilityStatus) => {
    if (!user) return;
    await setTrainingAttendance(trainingId, user.id, status, user.name);
  };

  const counts = {
    yes: attendance.filter((a) => a.status === "yes").length,
    no: attendance.filter((a) => a.status === "no").length,
    maybe: attendance.filter((a) => a.status === "maybe").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {CFG.map(({ s, Icon, label, active }) => (
          <button key={s} onClick={() => respond(s)}
            className={cn("flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-sm transition-all active:scale-95",
              myStatus === s ? active : "border-pitch-700 text-pitch-500 hover:border-pitch-500 hover:text-pitch-300")}>
            <Icon className="w-5 h-5" />
            <span className="text-xs">{label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="surface p-2"><p className="text-green-400 font-display text-xl">{counts.yes}</p><p className="text-xs text-pitch-600">Going</p></div>
        <div className="surface p-2"><p className="text-red-400 font-display text-xl">{counts.no}</p><p className="text-xs text-pitch-600">Not Going</p></div>
        <div className="surface p-2"><p className="text-amber-400 font-display text-xl">{counts.maybe}</p><p className="text-xs text-pitch-600">Maybe</p></div>
      </div>

      {attendance.filter((a) => a.status === "yes").length > 0 && (
        <div className="space-y-1">
          {attendance.filter((a) => a.status === "yes").map((a) => (
            <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-pitch-900">
              <div className="w-7 h-7 rounded-full bg-pitch-800 flex items-center justify-center text-xs text-pitch-300">
                {a.userName.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-white">{a.userName}</span>
              {a.userId === user?.id && <span className="text-xs text-pitch-600">(you)</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
