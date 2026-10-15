"use client";
import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { loadChallengeInbox, challengeApi } from "@/lib/public/challenges";
import type { GameFormat } from "@/features/formats/config";
import Link from "next/link";
import { useT } from "@/i18n";
import { defaultKickoff, fromLocalInput, toLocalInput } from "@/lib/utils/datetime";

interface Challenge {
  id: string; format: GameFormat; startsAt: string; endsAt: string | null; location: string;
  level: string; notes: string; status: string; expiresAt: string;
}
interface RequestRow {
  id: string; challengeId: string; challengeTeamId: string; teamId: string; teamName: string; message: string;
  status: string; createdAt: string; homeMatchId: string | null; awayMatchId: string | null;
  format: GameFormat; startsAt: string; location: string; challengeStatus: string;
}
interface Inbox { challenges: Challenge[]; requests: RequestRow[]; notifications: { id: string; kind: string; payload: Record<string, string>; readAt: string | null }[] }

export default function ChallengesPage() {
  const { t } = useT();
  const { team, canManage } = useAuth();
  const { data, mutate } = useSWR<Inbox>(team && canManage ? ["challenge-inbox", team.id] : null, () => loadChallengeInbox(team!.id) as Promise<Inbox>);
  const [format, setFormat] = useState<GameFormat>(team?.defaultFormat ?? "11v11");
  const [when, setWhen] = useState(toLocalInput(defaultKickoff()));
  const [location, setLocation] = useState("");
  const [level, setLevel] = useState("any");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: FormEvent) {
    e.preventDefault();
    const startsAt = fromLocalInput(when);
    if (!team || !startsAt || !location.trim()) return setMessage(t("err.invalid"));
    setBusy(true); setMessage("");
    try {
      await challengeApi({ action: "create", teamId: team.id, format, startsAt: startsAt.toISOString(), location, level, notes });
      setNotes(""); await mutate(); setMessage(t("admin.saved"));
    } catch { setMessage(t("admin.error")); } finally { setBusy(false); }
  }

  async function action(body: { action: string; requestId?: string; challengeId?: string; notificationId?: string; accept?: boolean }) {
    setBusy(true); setMessage("");
    try { await challengeApi(body); await mutate(); setMessage(t("admin.saved")); }
    catch { setMessage(t("admin.error")); } finally { setBusy(false); }
  }

  if (!team || !canManage) return null;
  const incoming = (data?.requests ?? []).filter((r) => r.challengeTeamId === team.id && r.status === "requested");
  const outgoing = (data?.requests ?? []).filter((r) => r.teamId === team.id);
  return <div className="space-y-7">
    <header><h1 className="font-display text-3xl">{t("admin.challenges")}</h1><p className="text-sm text-pitch-400 mt-1"><Link className="underline" href="/teams">{t("pub.title")}</Link> · <Link className="underline" href="/settings">{t("s.publicProfile")}</Link></p></header>
    <p role="status" className="min-h-5 text-sm text-green-300">{message}</p>
    <section className="space-y-3"><h2 className="font-display text-2xl">{t("admin.notifications")}</h2>
      {(data?.notifications ?? []).length === 0 ? <p className="text-sm text-pitch-400">{t("admin.empty")}</p> : <div className="surface divide-y divide-white/5">
        {data!.notifications.map((n) => <div key={n.id} className="px-4 py-3 flex items-center gap-3 text-sm">
          <span className="flex-1">{n.kind === "challenge_request" ? t("admin.notice.request") : t("admin.notice.status", { status: t(`admin.status.${n.payload.status ?? "open"}` as "admin.status.open") })}</span>
          {n.readAt ? <span className="text-xs text-pitch-500">{t("admin.read")}</span> : <button className="btn-ghost !py-1.5" disabled={busy} onClick={() => action({ action: "read_notification", notificationId: n.id })}>{t("admin.markRead")}</button>}
        </div>)}
      </div>}
    </section>
    <section className="space-y-3"><h2 className="font-display text-2xl">{t("admin.newChallenge")}</h2>
      <form onSubmit={create} className="surface p-4 grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-pitch-400">{t("fmt.label")}<select className="input-field mt-1" value={format} onChange={(e) => setFormat(e.target.value as GameFormat)}>
          {team.formats.map((x) => <option key={x} value={x}>{t(`fmt.${x}` as "fmt.11v11")}</option>)}
        </select></label>
        <label className="text-xs text-pitch-400">{t("pub.challengeTime")}<input className="input-field mt-1" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
        <label className="text-xs text-pitch-400">{t("pub.challengeLocation")}<input className="input-field mt-1" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} /></label>
        <label className="text-xs text-pitch-400">{t("pub.challengeLevel")}<select className="input-field mt-1" value={level} onChange={(e) => setLevel(e.target.value)}>
          {(["any", "beginner", "recreational", "intermediate", "competitive", "elite"] as const).map((x) => <option key={x} value={x}>{t(`level.${x}` as "level.any")}</option>)}
        </select></label>
        <label className="text-xs text-pitch-400 sm:col-span-2">{t("pub.requestMessage")}<textarea className="input-field mt-1" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></label>
        <button className="btn-primary sm:col-span-2" disabled={busy}>{busy ? t("c.wait") : t("c.save")}</button>
      </form>
    </section>
    <section className="space-y-3"><h2 className="font-display text-2xl">{t("admin.open")}</h2>
      {(data?.challenges ?? []).length === 0 ? <p className="text-sm text-pitch-400">{t("admin.empty")}</p> : <div className="space-y-2">{data!.challenges.map((c) => <article key={c.id} className="surface p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1"><p className="font-medium">{t(`fmt.${c.format}` as "fmt.11v11")} · {new Date(c.startsAt).toLocaleString()}</p><p className="text-sm text-pitch-400">{c.location} · {t(`admin.status.${c.status}` as "admin.status.open")}</p></div>
        <button className="btn-ghost" disabled={busy} onClick={() => action({ action: "cancel", challengeId: c.id })}>{t("admin.cancel")}</button>
      </article>)}</div>}
    </section>
    <section className="space-y-3"><h2 className="font-display text-2xl">{t("admin.incoming")}</h2>
      {incoming.length === 0 ? <p className="text-sm text-pitch-400">{t("admin.empty")}</p> : <div className="space-y-2">{incoming.map((r) => <article key={r.id} className="surface p-4 space-y-2">
        <p className="font-medium">{r.teamName} · {t(`fmt.${r.format}` as "fmt.11v11")} · {new Date(r.startsAt).toLocaleString()}</p><p className="text-sm text-pitch-400">{r.location}</p>{r.message && <p className="text-sm">{r.message}</p>}
        <div className="flex gap-2"><button disabled={busy} className="btn-primary" onClick={() => action({ action: "respond", requestId: r.id, accept: true })}>{t("admin.accept")}</button>
          <button disabled={busy} className="btn-ghost" onClick={() => action({ action: "respond", requestId: r.id, accept: false })}>{t("admin.decline")}</button></div>
      </article>)}</div>}
    </section>
    <section className="space-y-3"><h2 className="font-display text-2xl">{t("admin.outgoing")}</h2>
      {outgoing.length === 0 ? <p className="text-sm text-pitch-400">{t("admin.empty")}</p> : <div className="space-y-2">{outgoing.map((r) => <article key={r.id} className="surface p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1"><p className="font-medium">{t(`fmt.${r.format}` as "fmt.11v11")} · {new Date(r.startsAt).toLocaleString()}</p><p className="text-sm text-pitch-400">{r.location} · {t(`admin.status.${r.challengeStatus}` as "admin.status.open")}</p></div>
        {r.status === "requested" && <button className="btn-ghost" disabled={busy} onClick={() => action({ action: "cancel_request", requestId: r.id })}>{t("admin.cancel")}</button>}
        {r.status === "accepted" && r.challengeStatus === "accepted" && <button className="btn-primary" disabled={busy} onClick={() => action({ action: "confirm", requestId: r.id })}>{t("admin.confirm")}</button>}
      </article>)}</div>}
    </section>
  </div>;
}
