"use client";
import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Copy, LogOut, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createInvite, deleteInvite, listInvites, listMembers, removeMember, renameTeam, setStrictLinks, startSeason, type Invite } from "@/lib/db/teams";
import { friendlyError } from "@/lib/db/util";
import { copyText } from "@/lib/utils/clipboard";
import { Badge } from "@/components/ui/Badge";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { useT } from "@/i18n";

export default function SettingsPage() {
  const { t } = useT();
  const { team, member, seasons, season, setSeasonId, isOwner, email, reload, signOut, userId } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(team?.name ?? "");
  const [seasonName, setSeasonName] = useState("");
  const [note, setNote] = useState("");

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
              <span className="flex-1 truncate">{m.displayName}</span><Badge variant={m.role}>{t(`role.${m.role}`)}</Badge>
              {isOwner && m.userId !== userId && (
                <button aria-label={t("s.removeAria", { name: m.displayName })} className="p-1.5 text-pitch-500 hover:text-red-400"
                  onClick={() => confirm(t("s.confirmRemove", { name: m.displayName })) && run(async () => { await removeMember(team.id, m.userId); await refresh(); })}><Trash2 className="w-4 h-4" /></button>
              )}
            </li>
          ))}
        </ul>
        {isOwner && (
          <>
            <div className="flex gap-2">
              {(["coach", "staff"] as const).map((role) => (
                <button key={role} className="surface-2 px-3 py-2.5 text-sm flex-1"
                  onClick={() => run(async () => { if (!userId) return; await createInvite(team.id, role, userId); await refresh(); })}>
                  {t("s.invite", { role: t(`role.${role}`) })}
                </button>
              ))}
            </div>
            {invites.map((i) => (
              <div key={i.code} className="surface p-3 flex items-center gap-3 text-sm">
                <code className="flex-1 font-mono tracking-wider">{i.code}</code>
                <Badge variant={i.role}>{t(`role.${i.role}`)}</Badge>
                <button aria-label={t("s.copyCode")} className="p-1.5 text-pitch-400 hover:text-white" onClick={async () => say((await copyText(i.code)) ? t("s.codeCopied") : t("c.copyFail"))}><Copy className="w-4 h-4" /></button>
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
