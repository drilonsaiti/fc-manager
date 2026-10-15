"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { challengeApi } from "@/lib/public/challenges";
import { FORMAT_KEYS, type GameFormat } from "@/features/formats/config";
import { useT } from "@/i18n";

export interface PublicTeamRow {
  slug: string; name: string; logoUrl: string | null; city: string; formats: GameFormat[]; level: string; bio: string;
  rosterCount: number | null; contactPreference?: "in_app" | "email" | "phone" | null;
}
export interface PublicMatchRow {
  matchId: string; kickoff: string; format: GameFormat; opponent: string; venue: string; teamSlug: string; teamName: string; city: string; level: string;
}
export interface PublicChallengeRow {
  id: string; teamId: string; teamSlug: string; teamName: string; logoUrl: string | null; city: string; format: GameFormat;
  startsAt: string; endsAt: string | null; location: string; level: string; notes: string; expiresAt: string;
}

export function TeamDiscovery({ teams, matches, challenges }: {
  teams: PublicTeamRow[]; matches: PublicMatchRow[]; challenges: PublicChallengeRow[];
}) {
  const { t } = useT();
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("");
  const [format, setFormat] = useState("");
  const [level, setLevel] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const filterMatch = (x: { city?: string; location?: string; venue?: string; formats?: GameFormat[]; format?: GameFormat; level?: string; kickoff?: string; startsAt?: string }) => {
    const dateValue = x.kickoff ?? x.startsAt;
    return (!area || `${x.city ?? ""} ${x.location ?? ""} ${x.venue ?? ""}`.toLowerCase().includes(area.toLowerCase()))
    && (!format || x.formats?.includes(format as GameFormat) || x.format === format)
    && (!level || !x.level || x.level === "any" || x.level === level)
    && (!from || !dateValue || dateValue >= new Date(from).toISOString())
    && (!to || !dateValue || dateValue < new Date(`${to}T23:59:59.999`).toISOString());
  };
  const visibleTeams = teams.filter((x) => x.name.toLowerCase().includes(query.toLowerCase()) && filterMatch(x));
  const visibleMatches = matches.filter(filterMatch);
  const visibleChallenges = challenges.filter(filterMatch);
  const calendar = new Map<string, PublicMatchRow[]>();
  for (const match of visibleMatches) {
    const key = new Date(match.kickoff).toLocaleDateString();
    calendar.set(key, [...(calendar.get(key) ?? []), match]);
  }

  return <main className="mx-auto max-w-6xl px-4 py-10 space-y-10">
    <header className="space-y-2"><p className="text-xs uppercase tracking-widest text-pitch-400">FC Manager</p>
      <h1 className="font-display text-4xl sm:text-5xl">{t("pub.title")}</h1><p className="text-pitch-300">{t("pub.intro")}</p></header>
    <section className="surface p-4 grid sm:grid-cols-3 lg:grid-cols-6 gap-3" aria-label={t("pub.search")}>
      <input className="input-field" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("pub.search")} />
      <input className="input-field" value={area} onChange={(e) => setArea(e.target.value)} placeholder={t("pub.area")} />
      <select className="input-field" value={format} onChange={(e) => setFormat(e.target.value)}>
        <option value="">{t("pub.allFormats")}</option>{FORMAT_KEYS.map((x) => <option key={x} value={x}>{t(`fmt.${x}` as "fmt.11v11")}</option>)}
      </select>
      <select className="input-field" value={level} onChange={(e) => setLevel(e.target.value)}><option value="">{t("pub.allLevels")}</option>
        {(["beginner", "recreational", "intermediate", "competitive", "elite"] as const).map((x) => <option key={x} value={x}>{t(`level.${x}` as "level.any")}</option>)}
      </select>
      <label className="text-xs text-pitch-400">{t("pub.from")}<input className="input-field mt-1" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      <label className="text-xs text-pitch-400">{t("pub.to")}<input className="input-field mt-1" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
    </section>

    <section className="space-y-3"><h2 className="font-display text-2xl">{t("pub.challenges")}</h2>
      {visibleChallenges.length === 0 ? <p className="text-sm text-pitch-400">{t("pub.emptyChallenges")}</p> :
        <div className="grid md:grid-cols-2 gap-3">{visibleChallenges.map((x) => <ChallengeCard key={x.id} challenge={x} />)}</div>}
    </section>

    <section className="space-y-3"><h2 className="font-display text-2xl">{t("pub.matches")}</h2>
      {visibleMatches.length === 0 ? <p className="text-sm text-pitch-400">{t("pub.emptyMatches")}</p> :
        <div className="space-y-3">{[...calendar.entries()].map(([day, dayMatches]) => <section key={day} className="surface overflow-hidden">
          <h3 className="px-4 py-2 bg-white/5 text-xs uppercase tracking-widest text-pitch-300">{day}</h3>
          <div className="divide-y divide-white/5">{dayMatches.map((x) => <div key={x.matchId} className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <time className="font-medium tabular-nums" dateTime={x.kickoff}>{new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(x.kickoff))}</time>
            <span>{x.teamName} vs {x.opponent}</span><span className="text-pitch-400">{x.venue || x.city} · {t(`fmt.${x.format}` as "fmt.11v11")}</span>
            <Link href={`/teams/${encodeURIComponent(x.teamSlug)}`} className="ml-auto underline text-pitch-300">{t("pub.profile")}</Link>
          </div>)}</div>
        </section>)}</div>}
    </section>

    <section className="space-y-3"><h2 className="font-display text-2xl">{t("pub.teams")}</h2>
      {visibleTeams.length === 0 ? <p className="text-sm text-pitch-400">{t("pub.emptyTeams")}</p> :
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{visibleTeams.map((x) => <Link key={x.slug} href={`/teams/${encodeURIComponent(x.slug)}`} className="surface p-4 hover:bg-white/[0.07] transition-colors">
          <div className="flex gap-3 items-center"><div className="w-11 h-11 rounded-full bg-white/10 grid place-items-center font-display text-xl overflow-hidden">
            {x.logoUrl ? <Image src={x.logoUrl} alt="" width={44} height={44} unoptimized className="w-full h-full object-cover" /> : x.name.slice(0, 1)}</div>
            <div className="min-w-0"><h3 className="font-medium truncate">{x.name}</h3><p className="text-xs text-pitch-400">{x.city} · {t(`level.${x.level}` as "level.any")}</p></div></div>
          <p className="mt-3 text-sm text-pitch-300 line-clamp-2">{x.bio}</p>
          <p className="mt-3 text-xs text-pitch-400">{x.formats.map((f) => t(`fmt.${f}` as "fmt.11v11")).join(" · ")}{x.rosterCount != null ? ` · ${t("pub.squadCount", { count: x.rosterCount })}` : ""}</p>
        </Link>)}</div>}
    </section>
  </main>;
}

function ChallengeCard({ challenge }: { challenge: PublicChallengeRow }) {
  const { t } = useT();
  const { team, canManage } = useAuth();
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function request() {
    if (!team || !canManage) return;
    setBusy(true);
    try {
      await challengeApi({ action: "request", teamId: team.id, challengeId: challenge.id, message });
      setStatus(t("pub.requestSent"));
    } catch { setStatus(t("pub.requestFailed")); }
    finally { setBusy(false); }
  }
  async function report() {
    if (!team || !canManage || !reason.trim()) return;
    setBusy(true);
    try { await challengeApi({ action: "report", teamId: team.id, challengeId: challenge.id, reason }); setStatus(t("pub.reported")); }
    catch { setStatus(t("pub.requestFailed")); }
    finally { setBusy(false); }
  }
  async function block() {
    if (!team || !canManage || !window.confirm(t("pub.confirmBlock"))) return;
    setBusy(true);
    try { await challengeApi({ action: "block", teamId: team.id, blockedTeamId: challenge.teamId }); setStatus(t("pub.blocked")); }
    catch { setStatus(t("pub.requestFailed")); }
    finally { setBusy(false); }
  }
  return <article className="surface p-4 space-y-2">
    <div className="flex items-center justify-between gap-2"><Link className="font-medium underline" href={`/teams/${encodeURIComponent(challenge.teamSlug)}`}>{challenge.teamName}</Link>
      <span className="rounded-full bg-white/10 px-2 py-1 text-xs">{t(`fmt.${challenge.format}` as "fmt.11v11")}</span></div>
    <p className="text-sm">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(challenge.startsAt))}</p>
    <p className="text-sm text-pitch-300">{challenge.location} · {challenge.city}</p>
    <p className="text-xs text-pitch-400">{t(`level.${challenge.level}` as "level.any")}</p>
    {challenge.notes && <p className="text-sm text-pitch-300">{challenge.notes}</p>}
    {canManage && team?.slug !== challenge.teamSlug ? <>
      <label className="block"><span className="sr-only">{t("pub.requestMessage")}</span>
        <input className="input-field" maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("pub.requestMessage")} /></label>
      <div className="flex flex-wrap gap-2"><button disabled={busy} className="btn-primary" onClick={request}>{busy ? t("c.wait") : t("pub.request")}</button>
        <button disabled={busy} className="btn-ghost" onClick={block}>{t("pub.block")}</button></div>
      <div className="flex gap-2"><input className="input-field" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("pub.reportReason")} />
        <button disabled={busy || !reason.trim()} className="btn-ghost" onClick={report}>{t("pub.report")}</button></div>
    </> : !canManage ? <Link className="btn-primary inline-block" href="/login">{t("pub.loginRequired")}</Link> : null}
    {status && <p role="status" className="text-xs text-green-300">{status}</p>}
  </article>;
}
