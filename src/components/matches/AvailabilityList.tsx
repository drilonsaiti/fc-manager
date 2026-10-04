"use client";
import { useAuth } from "@/contexts/AuthContext";
import { useAvailability } from "@/hooks/useAvailability";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { cn } from "@/lib/utils/cn";
import { Check, X, HelpCircle } from "lucide-react";
import type { AvailabilityStatus } from "@/types";

const CFG = {
  yes:   { label: "Available",   Icon: Check,       color: "text-green-400", active: "border-green-500 bg-green-500/10 text-green-400" },
  no:    { label: "Unavailable", Icon: X,           color: "text-red-400",   active: "border-red-500 bg-red-500/10 text-red-400" },
  maybe: { label: "Maybe",       Icon: HelpCircle,  color: "text-amber-400", active: "border-amber-500 bg-amber-500/10 text-amber-400" },
} as const;

export function AvailabilityList({ matchId }: { matchId: string }) {
  const { user } = useAuth();
  const { summary, loading, getUserStatus, respond } = useAvailability(matchId);

  if (loading) return <div className="flex justify-center py-8"><LoadingSpinner /></div>;

  const myStatus = user ? getUserStatus(user.id) : null;

  return (
    <div className="space-y-6">
      {/* Response buttons */}
      <div className="surface-2 p-4 rounded-xl space-y-3">
        <p className="text-xs text-pitch-500 uppercase tracking-wider">Your response</p>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(CFG) as [AvailabilityStatus, typeof CFG[AvailabilityStatus]][]).map(([s, cfg]) => (
            <button key={s} onClick={() => user && respond(user.id, s, user)}
              className={cn("flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all active:scale-95",
                myStatus === s ? cfg.active : "border-pitch-700 text-pitch-500 hover:border-pitch-500 hover:text-pitch-300")}>
              <cfg.Icon className="w-6 h-6" />
              <span className="text-xs font-medium">{cfg.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Counts */}
      <div className="grid grid-cols-3 gap-2">
        {(["yes", "no", "maybe"] as AvailabilityStatus[]).map((s) => (
          <div key={s} className="surface p-3 text-center">
            <p className={cn("text-2xl font-display tracking-wider", CFG[s].color)}>{summary[s].length}</p>
            <p className="text-xs text-pitch-500 mt-0.5">{CFG[s].label}</p>
          </div>
        ))}
      </div>

      {/* Player lists */}
      {(["yes", "no", "maybe"] as AvailabilityStatus[]).map((s) => {
        const list = summary[s];
        if (!list.length) return null;
        const { Icon, color } = CFG[s];
        return (
          <div key={s}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className={cn("w-3.5 h-3.5", color)} />
              <h4 className="text-xs font-medium text-pitch-400 uppercase tracking-wider">
                {CFG[s].label} ({list.length})
              </h4>
            </div>
            <div className="space-y-1">
              {list.map((av) => (
                <div key={av.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-pitch-900">
                  <div className="w-8 h-8 rounded-full bg-pitch-800 flex items-center justify-center flex-shrink-0 text-xs font-medium text-pitch-300 overflow-hidden">
                    {av.userPhotoURL
                      ? <img src={av.userPhotoURL} alt="" className="w-full h-full object-cover" />
                      : av.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">
                      {av.userName}{av.userId === user?.id && <span className="text-pitch-600 text-xs ml-1">(you)</span>}
                    </p>
                    {av.userPosition && <p className="text-xs text-pitch-500">{av.userPosition}</p>}
                  </div>
                  {av.userJerseyNumber && <span className="text-pitch-600 font-mono text-sm">#{av.userJerseyNumber}</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {summary.total === 0 && (
        <p className="text-center text-pitch-600 text-sm py-4">No responses yet.</p>
      )}
    </div>
  );
}
