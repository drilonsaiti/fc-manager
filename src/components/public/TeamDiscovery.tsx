"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, House, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { challengeApi } from "@/lib/public/challenges";
import { FORMAT_KEYS, type GameFormat } from "@/features/formats/config";
import { useT } from "@/i18n";
import { safeImageUrl } from "@/lib/utils/safeImageUrl";

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
  const { t, locale } = useT();
  const { team } = useAuth();
  const pageSize = 6;
  const [activeTab, setActiveTab] = useState<"all" | "challenges" | "matches" | "teams">("all");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [teamArea, setTeamArea] = useState("");
  const [teamFormat, setTeamFormat] = useState("");
  const [teamLevel, setTeamLevel] = useState("");
  const [matchArea, setMatchArea] = useState("");
  const [matchFormat, setMatchFormat] = useState("");
  const [matchFrom, setMatchFrom] = useState("");
  const [matchTo, setMatchTo] = useState("");
  const [challengeArea, setChallengeArea] = useState("");
  const [challengeFormat, setChallengeFormat] = useState("");
  const [challengeLevel, setChallengeLevel] = useState("");
  const [challengeFrom, setChallengeFrom] = useState("");
  const [challengeTo, setChallengeTo] = useState("");
  const [teamPage, setTeamPage] = useState(0);
  const [matchPage, setMatchPage] = useState(0);
  const [challengePage, setChallengePage] = useState(0);
  const [visibleTeams, setVisibleTeams] = useState(teams);
  const [visibleMatches, setVisibleMatches] = useState(matches);
  const [visibleChallenges, setVisibleChallenges] = useState(challenges);
  const [teamHasMore, setTeamHasMore] = useState(teams.length === pageSize);
  const [matchHasMore, setMatchHasMore] = useState(matches.length === pageSize);
  const [challengeHasMore, setChallengeHasMore] = useState(challenges.length === pageSize);
  const [pending, setPending] = useState({ teams: true, matches: true, challenges: true });

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const abort = new AbortController();
    const load = async (kind: "directory" | "matches" | "challenges", page: number, params: Record<string, string>, update: (data: never[]) => void, hasMore: (value: boolean) => void, key: "teams" | "matches" | "challenges") => {
      const search = new URLSearchParams({ action: kind, limit: String(pageSize), offset: String(page * pageSize), ...params });
      setPending((state) => ({ ...state, [key]: true }));
      try {
        const response = await fetch(`/api/discovery?${search}`, { signal: abort.signal });
        if (!response.ok) throw new Error("Discovery request failed");
        const payload = await response.json() as { data?: never[] };
        const data = payload.data ?? [];
        update(data);
        hasMore(data.length === pageSize);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) update([]);
      } finally {
        if (!abort.signal.aborted) setPending((state) => ({ ...state, [key]: false }));
      }
    };
    if (activeTab === "all" || activeTab === "teams") {
      void load("directory", teamPage, { q: query, area: teamArea, format: teamFormat, level: teamLevel }, setVisibleTeams as (data: never[]) => void, setTeamHasMore, "teams");
    }
    if (activeTab === "all" || activeTab === "matches") {
      void load("matches", matchPage, { q: query, area: matchArea, format: matchFormat, from: matchFrom, to: matchTo }, setVisibleMatches as (data: never[]) => void, setMatchHasMore, "matches");
    }
    if (activeTab === "all" || activeTab === "challenges") {
      void load("challenges", challengePage, { q: query, area: challengeArea, format: challengeFormat, level: challengeLevel, from: challengeFrom, to: challengeTo }, setVisibleChallenges as (data: never[]) => void, setChallengeHasMore, "challenges");
    }
    return () => abort.abort();
  }, [activeTab, teamPage, matchPage, challengePage, query, teamArea, teamFormat, teamLevel, matchArea, matchFormat, matchFrom, matchTo, challengeArea, challengeFormat, challengeLevel, challengeFrom, challengeTo]);

  const filterControl = (label: string, value: string, set: (value: string) => void) => <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6c7569]">{label}<input className="mt-1.5 w-full rounded-xl border border-[#0d1510]/15 bg-white/70 px-3.5 py-3 text-sm text-[#0d1510] placeholder:text-[#6c7569]/70 focus:border-[#0d1510]/50 focus:outline-none" value={value} onChange={(e) => { set(e.target.value); setTeamPage(0); setMatchPage(0); setChallengePage(0); }} /></label>;
  const formatControl = (label: string, value: string, set: (value: string) => void) => <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6c7569]">{label}<select className="mt-1.5 w-full rounded-xl border border-[#0d1510]/15 bg-white/70 px-3.5 py-3 text-sm text-[#0d1510] focus:border-[#0d1510]/50 focus:outline-none" value={value} onChange={(e) => { set(e.target.value); setTeamPage(0); setMatchPage(0); setChallengePage(0); }}><option value="">{t("pub.allFormats")}</option>{FORMAT_KEYS.map((x) => <option key={x} value={x}>{t(`fmt.${x}` as "fmt.11v11")}</option>)}</select></label>;
  const dateControl = (label: string, value: string, set: (value: string) => void) => <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6c7569]">{label}<input type="date" className="mt-1.5 w-full rounded-xl border border-[#0d1510]/15 bg-white/70 px-3.5 py-3 text-sm text-[#0d1510] focus:border-[#0d1510]/50 focus:outline-none" value={value} onChange={(e) => { set(e.target.value); setTeamPage(0); setMatchPage(0); setChallengePage(0); }} /></label>;
  const pager = (page: number, more: boolean, setPage: (next: number) => void, loading: boolean) => <div className="flex items-center justify-between border-t border-[#0d1510]/10 pt-4 text-sm"><span className="text-[#6c7569]">{t("pub.page", { page: page + 1 })}</span><div className="flex gap-2"><button type="button" disabled={page === 0 || loading} onClick={() => setPage(page - 1)} className="inline-flex items-center gap-1 rounded-full border border-[#0d1510]/20 px-3 py-2 disabled:opacity-40"><ChevronLeft size={16} />{t("pub.previous")}</button><button type="button" disabled={!more || loading} onClick={() => setPage(page + 1)} className="inline-flex items-center gap-1 rounded-full bg-[#0d1510] px-3 py-2 text-[#efeadc] disabled:opacity-40">{t("pub.next")}<ChevronRight size={16} /></button></div></div>;
  const calendar = new Map<string, PublicMatchRow[]>();
  for (const match of visibleMatches) {
    const key = new Date(match.kickoff).toLocaleDateString();
    calendar.set(key, [...(calendar.get(key) ?? []), match]);
  }

  return <main className="min-h-screen bg-[#efeadc] text-[#0d1510]">
    <header className="relative isolate overflow-hidden rounded-b-[2rem] bg-[#0a1a12] px-5 pb-10 pt-7 text-[#efeadc] sm:px-10 sm:pb-14 sm:pt-9">
      <div aria-hidden className="absolute inset-0 -z-10 opacity-40" style={{ background: "repeating-linear-gradient(90deg,#0a1a12 0 9.09%,#10261b 9.09% 18.18%)" }} />
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><Link href="/" className="font-display text-xl tracking-wider">FC MANAGER</Link><div className="flex flex-wrap items-center gap-2 sm:gap-3"><Link href="/" className="inline-flex items-center gap-1.5 rounded-full border border-white/25 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[#efeadc] hover:bg-white/10"><House size={14} />{t("pub.home")}</Link><div className="text-[#efeadc]"><LangSwitch /></div><Link href={team ? "/dashboard" : "/login"} className="rounded-full bg-[#ffd84d] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#0d1510] hover:bg-white">{team ? t("lp.open") : t("lp.signin")}</Link></div></nav>
      <div className="mx-auto mt-16 max-w-7xl sm:mt-24"><p className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[.22em] text-[#ffd84d]"><span className="h-2 w-2 rounded-full bg-[#ffd84d]" />{t("pub.directoryEyebrow")}</p><h1 className="mt-5 max-w-4xl font-display text-5xl uppercase leading-[.94] tracking-wide sm:text-7xl lg:text-8xl">{t("pub.title")}</h1><p className="mt-5 max-w-xl text-sm leading-6 text-[#efeadc]/75 sm:text-base">{t("pub.intro")}</p></div>
    </header>
    <div className="mx-auto max-w-7xl space-y-10 px-5 py-10 sm:px-10 sm:py-14">
    <div className="space-y-5">
      <div role="tablist" aria-label={t("pub.directoryTabs")} className="flex gap-2 overflow-x-auto border-b border-[#0d1510]/15 pb-3">
        {(["all", "challenges", "matches", "teams"] as const).map((tab) => <button key={tab} id={`directory-tab-${tab}`} type="button" role="tab" aria-selected={activeTab === tab} aria-controls="directory-panel" onClick={() => setActiveTab(tab)} className={`shrink-0 rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === tab ? "bg-[#ffd84d] text-[#0d1510]" : "border border-[#0d1510]/15 text-[#6c7569] hover:border-[#0d1510]/40 hover:text-[#0d1510]"}`}>
          {tab === "all" ? t("pub.tabAll") : tab === "challenges" ? t("pub.challenges") : tab === "matches" ? t("pub.matches") : t("pub.teams")}
        </button>)}
      </div>
      <label className="relative block max-w-2xl"><Search aria-hidden="true" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6c7569]" /><span className="sr-only">{t("pub.searchAll")}</span><input type="search" className="w-full rounded-full border border-[#0d1510]/15 bg-white/70 py-3.5 pl-12 pr-5 text-sm text-[#0d1510] placeholder:text-[#6c7569]/75 focus:border-[#0d1510]/50 focus:outline-none" placeholder={t("pub.searchAll")} value={searchInput} onChange={(e) => { setSearchInput(e.target.value); setTeamPage(0); setMatchPage(0); setChallengePage(0); }} /></label>
    </div>

    <div id="directory-panel" role="tabpanel" aria-labelledby={`directory-tab-${activeTab}`} tabIndex={0} className="space-y-14">

    {(activeTab === "all" || activeTab === "challenges") && <section id="challenges" className="space-y-5">
      <SectionHeading eyebrow={t("pub.eyebrowChallenges")} title={t("pub.challenges")} count={visibleChallenges.length} />
      <div className="grid gap-3 rounded-2xl border border-[#0d1510]/10 bg-white/55 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {filterControl(t("pub.area"), challengeArea, setChallengeArea)}{formatControl(t("pub.formats"), challengeFormat, setChallengeFormat)}
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6c7569]">{t("pub.allLevels")}<select className="mt-1.5 w-full rounded-xl border border-[#0d1510]/15 bg-white/70 px-3.5 py-3 text-sm text-[#0d1510]" value={challengeLevel} onChange={(e) => { setChallengeLevel(e.target.value); setChallengePage(0); }}><option value="">{t("pub.allLevels")}</option>{(["beginner", "recreational", "intermediate", "competitive", "elite"] as const).map((x) => <option key={x} value={x}>{t(`level.${x}` as "level.any")}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-2">{dateControl(t("pub.from"), challengeFrom, setChallengeFrom)}{dateControl(t("pub.to"), challengeTo, setChallengeTo)}</div>
      </div>
      {visibleChallenges.length === 0 ? <EmptyResult text={t("pub.emptyChallenges")} loading={pending.challenges} /> : <div className="grid gap-3 md:grid-cols-2">{visibleChallenges.map((x) => <ChallengeCard key={x.id} challenge={x} />)}</div>}
      {pager(challengePage, challengeHasMore, setChallengePage, pending.challenges)}
    </section>}

    {(activeTab === "all" || activeTab === "matches") && <section id="matches" className="space-y-5"><SectionHeading eyebrow={t("pub.eyebrowMatches")} title={t("pub.matches")} count={visibleMatches.length} />
      <div className="grid gap-3 rounded-2xl border border-[#0d1510]/10 bg-white/55 p-4 sm:grid-cols-2 lg:grid-cols-4">{filterControl(t("pub.area"), matchArea, setMatchArea)}{formatControl(t("pub.formats"), matchFormat, setMatchFormat)}<div className="grid grid-cols-2 gap-2">{dateControl(t("pub.from"), matchFrom, setMatchFrom)}{dateControl(t("pub.to"), matchTo, setMatchTo)}</div></div>
      {visibleMatches.length === 0 ? <EmptyResult text={t("pub.emptyMatches")} loading={pending.matches} /> : <div className="space-y-3">{[...calendar.entries()].map(([day, dayMatches]) => <section key={day} className="overflow-hidden rounded-2xl border border-[#0d1510]/10 bg-white/70">
          <h3 className="bg-[#0d1510] px-4 py-2 text-xs uppercase tracking-widest text-[#efeadc]">{day}</h3>
          <div className="divide-y divide-[#0d1510]/10">{dayMatches.map((x) => <div key={x.matchId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-4 text-sm">
            <time className="font-semibold tabular-nums" dateTime={x.kickoff}>{new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(new Date(x.kickoff))}</time>
            <span className="font-medium">{x.teamName} <span className="text-[#6c7569]">vs</span> {x.opponent}</span><span className="text-[#6c7569]">{x.venue || x.city} · {t(`fmt.${x.format}` as "fmt.11v11")}</span>
            <Link href={`/teams/${encodeURIComponent(x.teamSlug)}`} className="ml-auto text-xs font-semibold uppercase tracking-wider underline decoration-[#e5392b] decoration-2 underline-offset-4">{t("pub.profile")}</Link>
          </div>)}</div>
        </section>)}</div>}
      {pager(matchPage, matchHasMore, setMatchPage, pending.matches)}
    </section>}

    {(activeTab === "all" || activeTab === "teams") && <section id="teams" className="space-y-5"><SectionHeading eyebrow={t("pub.eyebrowTeams")} title={t("pub.teams")} count={visibleTeams.length} />
      <div className="grid gap-3 rounded-2xl border border-[#0d1510]/10 bg-white/55 p-4 sm:grid-cols-2 lg:grid-cols-3">{filterControl(t("pub.area"), teamArea, setTeamArea)}{formatControl(t("pub.formats"), teamFormat, setTeamFormat)}<label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6c7569]">{t("pub.allLevels")}<select className="mt-1.5 w-full rounded-xl border border-[#0d1510]/15 bg-white/70 px-3.5 py-3 text-sm text-[#0d1510]" value={teamLevel} onChange={(e) => { setTeamLevel(e.target.value); setTeamPage(0); }}><option value="">{t("pub.allLevels")}</option>{(["beginner", "recreational", "intermediate", "competitive", "elite"] as const).map((x) => <option key={x} value={x}>{t(`level.${x}` as "level.any")}</option>)}</select></label></div>
      {visibleTeams.length === 0 ? <EmptyResult text={t("pub.emptyTeams")} loading={pending.teams} /> :
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visibleTeams.map((x) => <Link key={x.slug} href={`/teams/${encodeURIComponent(x.slug)}`} className="group rounded-2xl border border-[#0d1510]/10 bg-white/70 p-5 transition hover:-translate-y-0.5 hover:border-[#0d1510]/30 hover:bg-white">
          <div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-[#0a1a12] font-display text-xl text-[#ffd84d]">
            {safeImageUrl(x.logoUrl) ? <Image src={safeImageUrl(x.logoUrl)!} alt="" width={44} height={44} unoptimized referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = "none"; }} className="w-full h-full object-cover" /> : x.name.slice(0, 1)}</div>
            <div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{x.name}</h3><p className="text-xs text-[#6c7569]">{x.city} · {t(`level.${x.level}` as "level.any")}</p></div><Search size={16} className="text-[#6c7569] transition group-hover:text-[#e5392b]" /></div>
          <p className="mt-4 min-h-10 text-sm leading-5 text-[#6c7569] line-clamp-2">{x.bio}</p>
          <p className="mt-4 border-t border-[#0d1510]/10 pt-3 text-xs text-[#6c7569]">{x.formats.map((f) => t(`fmt.${f}` as "fmt.11v11")).join(" · ")}{x.rosterCount != null ? ` · ${t("pub.squadCount", { count: x.rosterCount })}` : ""}</p>
        </Link>)}</div>}
      {pager(teamPage, teamHasMore, setTeamPage, pending.teams)}
    </section>}
    </div>
    <footer className="border-t border-[#0d1510]/15 pt-5 text-xs uppercase tracking-widest text-[#6c7569]">FC MANAGER · {t("pub.directoryEyebrow")}</footer>
    </div>
  </main>;
}

function SectionHeading({ eyebrow, title, count }: { eyebrow: string; title: string; count: number }) {
  return <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#0d1510]/20 pb-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#e5392b]">{eyebrow}</p><h2 className="mt-1 font-display text-3xl uppercase leading-none sm:text-4xl">{title}</h2></div><span className="rounded-full bg-[#ffd84d] px-3 py-1 text-xs font-semibold tabular-nums">{count}</span></div>;
}

function EmptyResult({ text, loading }: { text: string; loading: boolean }) {
  return <div className="rounded-2xl border border-dashed border-[#0d1510]/20 bg-white/40 px-5 py-10 text-center text-sm text-[#6c7569]">{loading ? "Loading…" : text}</div>;
}

function ChallengeCard({ challenge }: { challenge: PublicChallengeRow }) {
  const { t, locale } = useT();
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
    <p className="text-sm">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(challenge.startsAt))}</p>
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
