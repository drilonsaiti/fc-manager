"use client";
import Link from "next/link";
import { format } from "date-fns";
import { MapPin, Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";
import type { Match } from "@/types";

const competitionLabel: Record<string, string> = {
  league: "League", cup: "Cup", friendly: "Friendly", tournament: "Tournament",
};

export function MatchCard({ match, availabilityCount, className }: {
  match: Match; availabilityCount?: { yes: number; total: number }; className?: string;
}) {
  return (
    <Link href={`/matches/${match.id}`}
      className={cn("surface p-4 flex flex-col gap-3 hover:border-pitch-600 hover:bg-pitch-800/50 transition-all active:scale-[0.99] group", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant={match.status === "upcoming" ? "upcoming" : "finished"}>{match.status}</Badge>
            <span className="text-xs text-pitch-500">{competitionLabel[match.competition]}</span>
            <span className="text-xs text-pitch-600">{match.isHome ? "HOME" : "AWAY"}</span>
          </div>
          <h3 className="text-white font-semibold truncate">vs {match.opponent}</h3>
        </div>
        {match.status === "finished" && match.homeScore != null ? (
          <span className="font-display text-2xl text-white tracking-wider flex-shrink-0">
            {match.homeScore}–{match.awayScore}
          </span>
        ) : (
          <ChevronRight className="w-4 h-4 text-pitch-600 group-hover:text-pitch-400 flex-shrink-0 mt-1 transition-colors" />
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5 text-xs text-pitch-400">
          <Clock className="w-3.5 h-3.5" />{format(match.date, "EEE, dd MMM · HH:mm")}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-pitch-400">
          <MapPin className="w-3.5 h-3.5" />{match.location}
        </span>
      </div>

      {availabilityCount !== undefined && match.status === "upcoming" && (
        <div className="flex items-center gap-2 pt-2 border-t border-pitch-800">
          <div className="flex-1 h-1.5 bg-pitch-800 rounded-full overflow-hidden">
            {availabilityCount.total > 0 && (
              <div className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${(availabilityCount.yes / availabilityCount.total) * 100}%` }} />
            )}
          </div>
          <span className="text-xs text-pitch-500">{availabilityCount.yes}/{availabilityCount.total} available</span>
        </div>
      )}
    </Link>
  );
}
