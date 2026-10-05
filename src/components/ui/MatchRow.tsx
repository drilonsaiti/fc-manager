import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "./Badge";
import { resultLetter } from "@/features/stats/aggregate";
import { shortDate } from "@/lib/utils/datetime";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import type { Match } from "@/types";

export function MatchRow({ match }: { match: Match }) {
  const { t } = useT();
  const r = match.status === "final" ? resultLetter(match) : null;
  return (
    <Link href={`/matches/${match.id}`} className="surface flex items-center gap-3 p-4 active:scale-[0.99] transition-transform">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{match.isHome ? t("m.vs") : t("m.at")} {match.opponent}</p>
        <p className="text-xs text-pitch-400 mt-0.5">{shortDate(match.kickoff)}{match.venue ? ` · ${match.venue}` : ""}</p>
      </div>
      {match.status === "final" && (
        <span className={cn("text-sm font-semibold tabular-nums px-2 py-1 rounded-md",
          r === "W" ? "bg-green-500/15 text-green-400" : r === "L" ? "bg-red-500/15 text-red-400" : "bg-white/10 text-pitch-200")}>
          {match.ourScore}–{match.theirScore}
        </span>
      )}
      {match.status === "live" && <Badge variant="no">{t("c.live")}</Badge>}
      {match.status === "cancelled" && <Badge>{t("c.cancelled")}</Badge>}
      <ChevronRight className="w-4 h-4 text-pitch-500 shrink-0" />
    </Link>
  );
}
