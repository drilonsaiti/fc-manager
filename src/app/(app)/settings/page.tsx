"use client";
import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Copy, LogOut, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createInvite, deleteInvite, listInvites, listMembers, removeMember, renameTeam, setMemberRole, setStrictLinks, startSeason, updatePublicProfile, type Invite } from "@/lib/db/teams";
import { friendlyError } from "@/lib/db/util";
import { copyText } from "@/lib/utils/clipboard";
import { Badge } from "@/components/ui/Badge";
import { Field } from "@/components/ui/Field";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { useT } from "@/i18n";
import type { Role, Team } from "@/types";
import { FORMAT_KEYS, type GameFormat } from "@/features/formats/config";

interface ProfileDraft {
  isPublic: boolean; slug: string; defaultFormat: GameFormat; formats: GameFormat[]; logoUrl: string;
  city: string; level: string; bio: string; contactPreference: "in_app" | "email" | "phone";
  publicSchedule: boolean; publicRosterCount: boolean; publicContact: boolean;
}

export default function SettingsPage() {
  const { t } = useT();
  const { team, member, seasons, season, setSeasonId, isOwner, email, reload, signOut, userId } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(team?.name ?? "");
  const [seasonName, setSeasonName] = useState("");
  const [note, setNote] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("coach");

  const membersQ = useSWR(team ? ["members", team.id] : null, () => listMembers(team!.id));
  const invitesQ = useSWR(team && isOwner ? ["invites", team.id] : null, () => listInvites(team!.id));
  const members = membersQ.data ?? [];
  const invites: Invite[] = invitesQ.data ?? [];
  const refresh = async () => { await Promise.all([membersQ.mutate(), invitesQ.mutate()]); };

  if (!team || !member) return null;
  const say = (text: string) => { setNote(text); setTimeout(() => setNote(""), 3000); };
  const run = async (fn: () => Promise<void>, ok?: string) => { try { await fn(); if (ok) say(ok); } catch (e) { say(friendlyError(e)); } };

  async function rename(e: FormEvent) {
    e.preventDefault();
    if (!team || !name.trim()) return;
    await run(async () => { await renameTeam(team.id, name); await reload(); }, t("s.saved"));
  }

  async function newSeason(e: FormEvent) {
    e.preventDefault();
    if (!team || !seasonName.trim()) return;
    if (!confirm(t("s.confirmSeason", { name: seasonName.trim() }))) return;
    await run(async () => { const id = await startSeason(team.id, seasonName.trim()); await reload(); setSeasonId(id); setSeasonName(""); }, t("s.seasonStarted"));
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl tracking-wide">{t("s.title")}</h1>
      <p role="status" className="text-sm text-green-400 min-h-5">{note}</p>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-pitch-500">{t("s.account")}</h2>
        <div className="surface p-4 flex items-center gap-3">
          <div className="flex-1 min-w-0"><p className="font-medium truncate">{member.displayName}</p><p className="text-xs text-pitch-500 truncate">{email}</p></div>
          <Badge variant={member.role}>{t(`role.${member.role}`)}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <button className="btn-ghost flex items-center gap-2" onClick={async () => { await signOut(); router.replace("/login"); }}><LogOut className="w-4 h-4" />{t("s.signOut")}</button>
          <LangSwitch />
        </div>
      </section>

      {isOwner && <PublicProfileSettings key={team.id} team={team} reload={reload} />}

      {isOwner && (
        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-widest text-pitch-500">{t("s.clubName")}</h2>
          <form onSubmit={rename} className="flex gap-2">
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            <button className="btn-primary">{t("c.save")}</button>
          </form>
        </section>
      )}

      {isOwner && (
        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-widest text-pitch-500">{t("s.links")}</h2>
          <label className="surface p-4 flex items-start gap-3 cursor-pointer">
            <input type="checkbox" className="mt-1 w-5 h-5 accent-white shrink-0" checked={team.strictLinks}
              onChange={(e) => run(async () => { await setStrictLinks(team.id, e.target.checked); await reload(); }, t("s.saved"))} />
            <span>
              <span className="block text-sm font-medium">{t("s.strict")}</span>
              <span className="block text-xs text-pitch-400 mt-0.5">{t("s.strictHelp")}</span>
            </span>
          </label>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-pitch-500">{t("s.seasons")}</h2>
        <div className="surface divide-y divide-white/5">
          {seasons.map((s) => (
            <button key={s.id} onClick={() => setSeasonId(s.id)} className="w-full flex items-center justify-between px-4 py-3 text-sm text-left">
              <span>{s.name}</span>
              <span className="flex gap-2">{s.isActive && <Badge variant="yes">{t("c.current")}</Badge>}{season?.id === s.id && <Badge>{t("c.viewing")}</Badge>}</span>
            </button>
          ))}
        </div>
        {isOwner && (
          <form onSubmit={newSeason} className="flex gap-2">
            <input className="input-field" placeholder={t("s.newSeasonPh")} value={seasonName} onChange={(e) => setSeasonName(e.target.value)} maxLength={40} />
            <button className="btn-primary whitespace-nowrap">{t("s.start")}</button>
          </form>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-pitch-500">{t("s.staff")}</h2>
        <ul className="surface divide-y divide-white/5">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="flex-1 truncate">{m.displayName}</span>
              {isOwner && m.userId !== userId ? (
                <select aria-label={t("s.changeRole", { name: m.displayName })} value={m.role}
                  onChange={(e) => run(async () => { await setMemberRole(team.id, m.userId, e.target.value as Role); await refresh(); }, t("s.saved"))}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-pitch-200">
                  {(["owner", "coach", "staff"] as const).map((r) => <option key={r} value={r} className="bg-pitch-900">{t(`role.${r}`)}</option>)}
                </select>
              ) : <Badge variant={m.role}>{t(`role.${m.role}`)}</Badge>}
              {isOwner && m.userId !== userId && (
                <button aria-label={t("s.removeAria", { name: m.displayName })} className="p-1.5 text-pitch-500 hover:text-red-400"
                  onClick={() => confirm(t("s.confirmRemove", { name: m.displayName })) && run(async () => { await removeMember(team.id, m.userId); await refresh(); })}><Trash2 className="w-4 h-4" /></button>
              )}
            </li>
          ))}
        </ul>
        {isOwner && (
          <>
            <div className="surface p-3 space-y-3">
              <fieldset>
                <legend className="text-xs text-pitch-400 mb-2">{t("s.inviteAs")}</legend>
                <div className="grid grid-cols-3 gap-1 p-1 surface-2" role="radiogroup">
                  {(["owner", "coach", "staff"] as const).map((r) => (
                    <button key={r} type="button" role="radio" aria-checked={inviteRole === r} onClick={() => setInviteRole(r)}
                      className={"py-2 rounded-lg text-xs font-medium transition-colors " + (inviteRole === r ? "bg-white text-black" : "text-pitch-400 hover:text-white")}>
                      {t(`role.${r}`)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-pitch-500 mt-2">{t(`s.roleHelp.${inviteRole}` as "s.roleHelp.owner")}</p>
              </fieldset>
              <button className="btn-primary w-full py-2.5"
                onClick={() => run(async () => { if (!userId) return; await createInvite(team.id, inviteRole, userId); await refresh(); })}>
                {t("s.createInvite", { role: t(`role.${inviteRole}`) })}
              </button>
            </div>
            {invites.map((i) => (
              <div key={i.code} className="surface p-3 flex items-center gap-3 text-sm">
                <code className="flex-1 font-mono tracking-wider">{i.code}</code>
                <Badge variant={i.role}>{t(`role.${i.role}`)}</Badge>
                <button aria-label={t("s.copyInviteLink")} className="p-1.5 text-pitch-400 hover:text-white" onClick={async () => {
                  const url = new URL("/login", window.location.origin);
                  url.searchParams.set("mode", "join");
                  url.searchParams.set("code", i.code);
                  say((await copyText(url.toString())) ? t("s.inviteLinkCopied") : t("c.copyFail"));
                }}><Copy className="w-4 h-4" /></button>
                <button aria-label={t("s.deleteInvite")} className="p-1.5 text-pitch-500 hover:text-red-400" onClick={() => run(async () => { await deleteInvite(i.code); await refresh(); })}><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            {invites.length > 0 && <p className="text-xs text-pitch-500">{t("s.inviteHelp")}</p>}
          </>
        )}
      </section>
    </div>
  );
}

function PublicProfileSettings({ team, reload }: { team: Team; reload: () => Promise<void> }) {
  const { t } = useT();
  const [profile, setProfile] = useState<ProfileDraft>(() => ({
    isPublic: team.isPublic, slug: team.slug ?? "", defaultFormat: team.defaultFormat,
    formats: team.formats, logoUrl: team.logoUrl ?? "", city: team.city, level: team.level, bio: team.bio,
    contactPreference: team.contactPreference, publicSchedule: team.publicSchedule,
    publicRosterCount: team.publicRosterCount, publicContact: team.publicContact,
  }));
  const [message, setMessage] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    const slug = profile.slug.trim().toLowerCase();
    if (profile.isPublic && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { setMessage(t("err.invalid")); return; }
    const formats = profile.formats.includes(profile.defaultFormat) ? profile.formats : [...profile.formats, profile.defaultFormat];
    try {
      await updatePublicProfile(team.id, { ...profile, slug: slug || null, formats, logoUrl: profile.logoUrl.trim() || null });
      await reload(); setMessage(t("s.saved"));
    } catch (e) { setMessage(friendlyError(e)); }
  }
  return <section className="space-y-3">
    <h2 className="text-xs uppercase tracking-widest text-pitch-500">{t("s.publicProfile")}</h2>
    <form onSubmit={save} className="surface p-4 space-y-3">
      <label className="flex gap-3 items-start text-sm"><input type="checkbox" className="mt-1 w-5 h-5 accent-white" checked={profile.isPublic}
        onChange={(e) => setProfile({ ...profile, isPublic: e.target.checked })} />
        <span><span className="font-medium">{t("s.makePublic")}</span><span className="block text-xs text-pitch-400 mt-1">{t("s.profileHelp")}</span></span>
      </label>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={t("s.profileSlug")}><input className="input-field" value={profile.slug} onChange={(e) => setProfile({ ...profile, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") })} maxLength={80} placeholder="your-team" /></Field>
        <Field label={t("s.city")}><input className="input-field" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} maxLength={100} /></Field>
        <Field label={t("s.logoUrl")}><input className="input-field" type="url" value={profile.logoUrl} onChange={(e) => setProfile({ ...profile, logoUrl: e.target.value })} maxLength={500} /></Field>
        <Field label={t("s.level")}><select className="input-field" value={profile.level} onChange={(e) => setProfile({ ...profile, level: e.target.value })}>
          {(["any", "beginner", "recreational", "intermediate", "competitive", "elite"] as const).map((x) => <option key={x} value={x}>{t(`level.${x}` as "level.any")}</option>)}
        </select></Field>
        <Field label={t("fmt.label")}><select className="input-field" value={profile.defaultFormat} onChange={(e) => setProfile({ ...profile, defaultFormat: e.target.value as GameFormat })}>
          {FORMAT_KEYS.map((x) => <option key={x} value={x}>{t(`fmt.${x}` as "fmt.11v11")}</option>)}
        </select></Field>
        <Field label={t("s.contactPreference")}><select className="input-field" value={profile.contactPreference} onChange={(e) => setProfile({ ...profile, contactPreference: e.target.value as ProfileDraft["contactPreference"] })}>
          <option value="in_app">{t("s.contact.in_app")}</option><option value="email">{t("s.contact.email")}</option><option value="phone">{t("s.contact.phone")}</option>
        </select></Field>
      </div>
      <fieldset><legend className="text-xs text-pitch-400 mb-2">{t("pub.formats")}</legend><div className="flex flex-wrap gap-2">
        {FORMAT_KEYS.map((x) => <label key={x} className="surface-2 rounded-lg px-2.5 py-2 text-xs flex items-center gap-2"><input type="checkbox" checked={profile.formats.includes(x)}
          onChange={(e) => setProfile({ ...profile, formats: e.target.checked ? [...profile.formats, x] : profile.formats.filter((f) => f !== x) })} />{t(`fmt.${x}` as "fmt.11v11")}</label>)}
      </div></fieldset>
      <Field label={t("s.bio")}><textarea className="input-field" rows={3} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} maxLength={500} /></Field>
      <div className="space-y-2">
        {([["publicSchedule", "s.publicSchedule"], ["publicRosterCount", "s.publicRoster"], ["publicContact", "s.publicContact"]] as const).map(([key, label]) => (
          <label key={key} className="flex gap-2 items-center text-sm text-pitch-200"><input type="checkbox" checked={profile[key]} onChange={(e) => setProfile({ ...profile, [key]: e.target.checked })} />{t(label)}</label>
        ))}
      </div>
      <button className="btn-primary">{t("c.save")}</button>
      {message && <p role="status" className="text-xs text-pitch-300">{message}</p>}
      {profile.isPublic && profile.slug && <p className="text-xs text-pitch-500">/teams/{profile.slug}</p>}
    </form>
  </section>;
}
