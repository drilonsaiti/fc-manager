"use client";
import type { RosterPlayer } from "@/types";

export function RosterPlayerCard({ player, onClick }: { player: RosterPlayer; onClick?: () => void }) {
  const [primary, ...others] = player.positions;
  const body = (
    <>
      <span className="w-11 h-11 rounded-full bg-pitch-800 border border-pitch-700 flex items-center justify-center text-sm font-mono text-pitch-200 flex-shrink-0">
        {player.number ?? player.name.charAt(0).toUpperCase()}
      </span>
      <span className="flex-1 min-w-0 text-left">
        <span className="block text-white font-medium truncate">{player.name}</span>
        <span className="block text-xs text-pitch-500 truncate">
          {primary ?? "No position set"}{others.length > 0 && ` · also ${others.length}`}
        </span>
      </span>
    </>
  );
  const cls = "surface p-3 flex items-center gap-3 w-full min-h-16";
  return onClick
    ? <button onClick={onClick} className={`${cls} hover:border-pitch-600 active:scale-[0.99] transition-all`}>{body}</button>
    : <div className={cls}>{body}</div>;
}
