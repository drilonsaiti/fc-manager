"use client";
import { Badge } from "@/components/ui/Badge";
import type { User } from "@/types";

export function PlayerCard({ player, stats, onClick }: {
  player: User;
  stats?: { goals: number; assists: number; matches: number };
  onClick?: () => void;
}) {
  return (
    <div onClick={onClick}
      className={`surface p-4 flex flex-col gap-3 transition-all ${onClick ? "cursor-pointer hover:border-pitch-600 hover:bg-pitch-800/50 active:scale-[0.99]" : ""}`}>
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-pitch-800 border border-pitch-700 flex items-center justify-center overflow-hidden">
            {player.photoURL
              ? <img src={player.photoURL} alt={player.name} className="w-full h-full object-cover" />
              : <span className="text-lg font-display text-pitch-300">{player.name.charAt(0).toUpperCase()}</span>}
          </div>
          {player.jerseyNumber && (
            <span className="absolute -bottom-1 -right-1 bg-pitch-700 text-xs text-white font-mono rounded px-1 leading-5">#{player.jerseyNumber}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate">{player.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {player.position && <span className="text-xs text-pitch-500">{player.position}</span>}
            <Badge variant={player.role}>{player.role}</Badge>
          </div>
        </div>
      </div>
      {stats && (
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-pitch-800">
          {[["Goals", stats.goals], ["Assists", stats.assists], ["Apps", stats.matches]].map(([label, value]) => (
            <div key={label} className="text-center">
              <p className="text-white font-display text-lg tracking-wider">{value}</p>
              <p className="text-pitch-600 text-xs">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
