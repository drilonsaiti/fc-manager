"use client";
import { useState } from "react";
import { Bell, Check, Copy, HelpCircle, Link2, Lock, Unlock, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAvailability } from "@/hooks/data";
import { setResponse, setAttended } from "@/lib/db/responses";
import { setResponsesOpen as setMatchOpen } from "@/lib/db/matches";
import { setTrainingResponsesOpen } from "@/lib/db/trainings";
import { friendlyError } from "@/lib/db/util";
import { buildInviteText, buildReminderText, buildShareUrl } from "@/features/availability/logic";
import { copyText } from "@/lib/utils/clipboard";
import { cn } from "@/lib/utils/cn";
import type { AvailabilityState, AvailabilityStatus, EventKind, Player } from "@/types";

const META: Record<AvailabilityState, { label: string; dot: string }> = {
  yes: { label: "Available", dot: "bg-green-500" },
  maybe: { label: "Maybe", dot: "bg-amber-400" },
  none: { label: "No response", dot: "bg-pitch-500" },
  no: { label: "Unavailable", dot: "bg-red-500" },
};
const ORDER: AvailabilityState[] = ["yes", "maybe", "none", "no"];

interface Props {
  kind: EventKind;
  eventId: string;
  title: string;
  startsAt: Date;
  place: string;
  shareToken: string;
  responsesOpen: boolean;
  /** Matches that are live/finished no longer take answers. */
  locked?: boolean;
  players: Player[];
  onOpenChange: () => void;
  /** Trainings: show "who came" toggles. */
  showAttendance?: boolean;
}

export function AvailabilityPanel(p: Props) {
  const { team, canManage } = useAuth();
  const { rows, summary, responses, mutate } = useAvailability(p.kind, p.eventId, p.players);
  const [note, setNote] = useState("");
  const url = typeof window === "undefined" ? "" : buildShareUrl(window.location.origin, p.shareToken);
  const attended = new Set(responses.filter((r) => r.attended).map((r) => r.playerId));

  function flash(text: string) { setNote(text); setTimeout(() => setNote(""), 2500); }

  async function copy(text: string, done: string) {
    flash((await copyText(text)) ? done : "Couldn't copy. Select and copy manually.");
  }

  async function answer(playerId: string, status: AvailabilityStatus) {
    if (!team) return;
    try {
      await setResponse(p.kind, p.eventId, team.id, playerId, status);
      await mutate();
    } catch (e) { flash(friendlyError(e)); }
  }

  async function toggleAttended(playerId: string) {
    if (!team) return;
    try {
      await setAttended(p.eventId, team.id, playerId, !attended.has(playerId));
      await mutate();
    } catch (e) { flash(friendlyError(e)); }
  }

  async function toggleOpen() {
    try {
      if (p.kind === "match") await setMatchOpen(p.eventId, !p.responsesOpen);
      else await setTrainingResponsesOpen(p.eventId, !p.responsesOpen);
      p.onOpenChange();
    } catch (e) { flash(friendlyError(e)); }
  }

  const missing = summary.none.map((r) => r.player);
  const closed = p.locked || !p.responsesOpen;

  return (
    <section className="space-y-4" aria-label="Availability">
      {/* Counts */}
      <div className="grid grid-cols-4 gap-2">
        {ORDER.map((s) => (
          <div key={s} className="surface-2 p-3 text-center">
            <p className="text-2xl font-semibold tabular-nums">{summary[s].length}</p>
            <p className="text-[11px] text-pitch-400 leading-tight">{META[s].label}</p>
          </div>
        ))}
      </div>

      {/* Share */}
      {canManage && (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-primary flex items-center justify-center gap-2 py-3"
            onClick={() => copy(buildInviteText({ kind: p.kind, title: p.title, date: p.startsAt, place: p.place, url }), "Link & message copied — paste it in your group chat")}>
            <Link2 className="w-4 h-4" />Copy link
          </button>
          <button className="surface-2 flex items-center justify-center gap-2 py-3 text-sm font-medium disabled:opacity-40"
            disabled={missing.length === 0}
            onClick={() => copy(buildReminderText({ title: p.title, date: p.startsAt, url, missing }), `Reminder copied (${missing.length} still to answer)`)}>
            <Bell className="w-4 h-4" />Copy reminder
          </button>
        </div>
      )}
      <p className="text-xs min-h-4 text-green-400" role="status">{note}</p>

      {/* Per player */}
      <ul className="surface divide-y divide-white/5">
        {rows.length === 0 && <li className="p-4 text-sm text-pitch-400">Add players to the squad first.</li>}
        {rows
          .slice()
          .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.player.name.localeCompare(b.player.name))
          .map(({ player, status }) => (
            <li key={player.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", META[status].dot)} aria-hidden />
              <span className="flex-1 min-w-0 truncate text-sm">
                {player.name}
                <span className="sr-only"> — {META[status].label}</span>
              </span>
              {canManage && !p.locked && (
                <span className="flex gap-1">
                  {(["yes", "maybe", "no"] as const).map((s) => {
                    const Icon = s === "yes" ? Check : s === "maybe" ? HelpCircle : X;
                    return (
                      <button key={s} aria-label={`Mark ${player.name} ${META[s].label}`} aria-pressed={status === s}
                        onClick={() => answer(player.id, s)}
                        className={cn("w-9 h-9 rounded-lg flex items-center justify-center border transition-colors",
                          status === s ? "bg-white text-black border-white" : "border-white/10 text-pitch-400 hover:text-white")}>
                        <Icon className="w-4 h-4" />
                      </button>
                    );
                  })}
                </span>
              )}
              {p.showAttendance && canManage && (
                <label className="flex items-center gap-1.5 text-xs text-pitch-400 pl-2">
                  <input type="checkbox" className="w-4 h-4 accent-white" checked={attended.has(player.id)} onChange={() => toggleAttended(player.id)} />
                  Came
                </label>
              )}
            </li>
          ))}
      </ul>

      {canManage && !p.locked && (
        <button onClick={toggleOpen} className="btn-ghost flex items-center gap-2">
          {closed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          {closed ? "Re-open answers" : "Close answers"}
        </button>
      )}
      {url && (
        <button className="text-xs text-pitch-500 flex items-center gap-1.5 break-all text-left" onClick={() => copy(url, "Link copied")}>
          <Copy className="w-3 h-3 shrink-0" />{url}
        </button>
      )}
    </section>
  );
}
