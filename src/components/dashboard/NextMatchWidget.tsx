"use client";
import Link from "next/link";
import { format, isToday, isTomorrow } from "date-fns";
import { Calendar, MapPin, Clock, ArrowRight } from "lucide-react";
import type { Match } from "@/types";

export function NextMatchWidget({ match, availability }: {
  match: Match;
  availability: { yes: number; no: number; maybe: number; none: number; total: number };
}) {
  const dateLabel = isToday(match.date) ? "Today"
    : isTomorrow(match.date) ? "Tomorrow"
    : format(match.date, "EEEE, dd MMMM");

  const pct = (n: number) => (availability.total > 0 ? (n / availability.total) * 100 : 0);

  return (
    <Link href={`/matches/${match.id}`}
      className="surface p-5 flex flex-col gap-4 hover:border-pitch-600 transition-all group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-pitch-500 uppercase tracking-wider mb-1">Next Match</p>
          <h2 className="text-xl font-semibold text-white">vs {match.opponent}</h2>
        </div>
        <ArrowRight className="w-5 h-5 text-pitch-600 group-hover:text-white transition-colors mt-1" />
      </div>

      <div className="flex flex-wrap gap-3">
        <span className="flex items-center gap-1.5 text-sm text-pitch-400"><Calendar className="w-4 h-4" />{dateLabel}</span>
        <span className="flex items-center gap-1.5 text-sm text-pitch-400"><Clock className="w-4 h-4" />{format(match.date, "HH:mm")}</span>
        <span className="flex items-center gap-1.5 text-sm text-pitch-400"><MapPin className="w-4 h-4" />{match.location}</span>
      </div>

      <div className="space-y-2">
        <div className="h-2 bg-pitch-800 rounded-full overflow-hidden flex">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${pct(availability.yes)}%` }} />
          <div className="h-full bg-amber-500 transition-all" style={{ width: `${pct(availability.maybe)}%` }} />
          <div className="h-full bg-red-500/70 transition-all" style={{ width: `${pct(availability.no)}%` }} />
        </div>
        <p className="text-sm text-pitch-400">
          <span className="text-green-400 font-medium">{availability.yes} available</span>
          <span className="text-pitch-600"> · </span><span className="text-amber-400">{availability.maybe} maybe</span>
          <span className="text-pitch-600"> · </span><span className="text-red-400">{availability.no} out</span>
          <span className="text-pitch-600"> · </span><span className="text-pitch-300">{availability.none} no response</span>
        </p>
      </div>
    </Link>
  );
}
