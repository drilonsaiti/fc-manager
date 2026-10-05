"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, X, HelpCircle, Link2, BellRing, Loader2, UserPlus } from "lucide-react";
import type { useMatchAvailability } from "@/hooks/useMatchAvailability";
import { buildInviteText, buildReminderText, buildShareUrl } from "@/features/availability/logic";
import { copyText } from "@/lib/utils/clipboard";
import { cn } from "@/lib/utils/cn";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { AvailabilityState, AvailabilityStatus, Match } from "@/types";

const STATES: { key: AvailabilityState; label: string; text: string; tile: string }[] = [
  { key: "yes",   label: "Available",   text: "text-green-400", tile: "border-green-500/25" },
  { key: "maybe", label: "Maybe",       text: "text-amber-400", tile: "border-amber-500/25" },
  { key: "none",  label: "No response", text: "text-pitch-300", tile: "border-pitch-600" },
  { key: "no",    label: "Unavailable", text: "text-red-400",   tile: "border-red-500/25" },
];

const SET: { status: AvailabilityStatus; label: string; Icon: typeof Check; active: string }[] = [
  { status: "yes",   label: "Available",   Icon: Check,      active: "bg-green-500 text-black" },
  { status: "maybe", label: "Maybe",       Icon: HelpCircle, active: "bg-amber-500 text-black" },
  { status: "no",    label: "Unavailable", Icon: X,          active: "bg-red-500 text-white" },
];

export function AvailabilityPanel({ match, canManage, availability }: {
  match: Match; canManage: boolean; availability: ReturnType<typeof useMatchAvailability>;
}) {
  const { token, rows, summary, loading, ensureLink, setStatus } = availability;
  const [notice, setNotice] = useState<{ kind: "invite" | "reminder" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const flash = (kind: "invite" | "reminder" | "error", text: string) => {
    setNotice({ kind, text });
    setTimeout(() => setNotice(null), 2500);
  };

  const urlFor = (t: string) => buildShareUrl(window.location.origin, t);

  const copyInvite = async () => {
    setBusy(true);
    try {
      const t = await ensureLink();
      if (!t) throw new Error("no link");
      const text = buildInviteText({ title: `${match.isHome ? "" : "(Away) "}vs ${match.opponent}`.trim(), date: match.date, location: match.location, url: urlFor(t) });
      if (typeof navigator.share === "function") {
        try { await navigator.share({ text }); return; } catch { /* dismissed — fall through to copy */ }
      }
      const ok = await copyText(text);
      flash(ok ? "invite" : "error", ok ? "Link copied — paste it in your group chat" : "Couldn't copy. Try again.");
    } catch {
      flash("error", "Couldn't create the link. Check your connection.");
    } finally { setBusy(false); }
  };

  const copyReminder = async () => {
    if (!token) return;
    const text = buildReminderText({
      title: `vs ${match.opponent}`, date: match.date, url: urlFor(token),
      missing: summary.none.map((r) => r.player),
    });
    const ok = await copyText(text);
    flash(ok ? "reminder" : "error", ok ? `Reminder copied for ${summary.none.length} player${summary.none.length === 1 ? "" : "s"}` : "Couldn't copy. Try again.");
  };

  if (loading) return <div className="flex justify-center py-8"><LoadingSpinner /></div>;

  if (rows.length === 0) {
    return (
      <div className="surface p-6 text-center space-y-3">
        <p className="text-white font-medium">No players in the squad yet</p>
        <p className="text-sm text-pitch-500">Add your players first, then share one link and they answer in seconds.</p>
        {canManage && (
          <Link href="/players" className="btn-primary inline-flex items-center gap-1.5">
            <UserPlus className="w-4 h-4" /> Add players
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {STATES.map(({ key, label, text, tile }) => (
          <div key={key} className={cn("surface p-3 text-center border", tile)}>
            <p className={cn("text-3xl font-display tracking-wider", text)}>{summary[key].length}</p>
            <p className="text-xs text-pitch-500 uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      {canManage && (
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={copyInvite} disabled={busy}
            className="btn-primary flex-1 min-h-12 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            {token ? "Share link" : "Create & share link"}
          </button>
          {token && summary.none.length > 0 && (
            <button onClick={copyReminder}
              className="btn-ghost flex-1 min-h-12 flex items-center justify-center gap-2 border border-pitch-700">
              <BellRing className="w-4 h-4" /> Copy reminder ({summary.none.length})
            </button>
          )}
        </div>
      )}

      <div aria-live="polite" className="min-h-5">
        {notice && (
          <p className={cn("text-sm text-center", notice.kind === "error" ? "text-red-400" : "text-green-400")}>{notice.text}</p>
        )}
      </div>

      {STATES.map(({ key, label, text }) => {
        const list = summary[key];
        if (list.length === 0) return null;
        return (
          <section key={key} className="space-y-1.5">
            <h4 className={cn("text-xs font-medium uppercase tracking-wider", text)}>{label} ({list.length})</h4>
            {list.map(({ player, status }) => (
              <div key={player.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-pitch-900 min-h-14">
                <span className="w-9 h-9 rounded-full bg-pitch-800 flex items-center justify-center text-xs font-mono text-pitch-300 flex-shrink-0">
                  {player.number ?? player.name.charAt(0).toUpperCase()}
                </span>
                <p className="flex-1 min-w-0 text-sm text-white font-medium truncate">{player.name}</p>
                {canManage && (
                  <div className="flex gap-1" role="group" aria-label={`Set availability for ${player.name}`}>
                    {SET.map(({ status: s, label: l, Icon, active }) => (
                      <button key={s} aria-label={`${player.name}: ${l}`} aria-pressed={status === s}
                        onClick={() => setStatus(player.id, s).catch(() => flash("error", "Couldn't save. Try again."))}
                        className={cn("w-11 h-11 rounded-lg flex items-center justify-center transition-colors active:scale-95",
                          status === s ? active : "bg-pitch-800 text-pitch-500 hover:text-white")}>
                        <Icon className="w-5 h-5" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
