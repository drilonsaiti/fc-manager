"use client";
import type { PublicMatchRow, PublicTeamRow } from "@/components/public/TeamDiscovery";
import { useT } from "@/i18n";
import Image from "next/image";

export function TeamProfile({ profile, matches }: { profile: PublicTeamRow; matches: PublicMatchRow[] }) {
  const { t } = useT();
  return <>
    <header className="surface p-5 sm:p-7 space-y-3">
      <p className="text-xs uppercase tracking-widest text-pitch-400">{t("pub.profile")}</p>
      {profile.logoUrl && <Image src={profile.logoUrl} alt="" width={88} height={88} unoptimized className="w-20 h-20 rounded-full object-cover bg-white/10" />}
      <h1 className="font-display text-4xl sm:text-5xl">{profile.name}</h1>
      <p className="text-pitch-300">{profile.city}{profile.level ? ` · ${t(`level.${profile.level}` as "level.any")}` : ""}</p>
      {profile.bio && <p className="max-w-2xl text-sm text-pitch-200 whitespace-pre-wrap">{profile.bio}</p>}
      <div className="flex flex-wrap gap-2">{profile.formats.map((format) => <span key={format} className="rounded-full bg-white/10 px-3 py-1 text-xs">{t(`fmt.${format}` as "fmt.11v11")}</span>)}</div>
      {profile.rosterCount != null && <p className="text-sm text-pitch-300">{t("pub.squadCount", { count: profile.rosterCount })}</p>}
      {profile.contactPreference && <p className="text-xs text-pitch-400">{t("pub.contact")}: {t(`s.contact.${profile.contactPreference}` as "s.contact.in_app")}</p>}
    </header>
    {matches.length > 0 && <section className="space-y-3"><h2 className="font-display text-2xl">{t("pub.matches")}</h2>
      <div className="surface divide-y divide-white/5">{matches.map((m) => <div key={m.matchId} className="px-4 py-3 flex flex-wrap gap-2 text-sm">
        <time dateTime={m.kickoff}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(m.kickoff))}</time>
        <span>{m.opponent}</span><span className="text-pitch-400">{m.venue} · {t(`fmt.${m.format}` as "fmt.11v11")}</span>
      </div>)}</div>
    </section>}
  </>;
}
