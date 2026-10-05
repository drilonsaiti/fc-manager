"use client";
import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Copy, Download, LogOut, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createInvite, deleteInvite, listInvites, listMembers, removeMember, renameTeam, startSeason, type Invite } from "@/lib/db/teams";
import { exportTeam } from "@/lib/db/backup";
import { friendlyError } from "@/lib/db/util";
import { copyText } from "@/lib/utils/clipboard";
import { Badge } from "@/components/ui/Badge";

export default function SettingsPage() {
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
  const say = (t: string) => { setNote(t); setTimeout(() => setNote(""), 3000); };
  const run = async (fn: () => Promise<void>, ok?: string) => { try { await fn(); if (ok) say(ok); } catch (e) { say(friendlyError(e)); } };

  async function rename(e: FormEvent) {
    e.preventDefault();
    if (!team || !name.trim()) return;
    await run(async () => { await renameTeam(team.id, name); await reload(); }, "Saved");
  }

  async function newSeason(e: FormEvent) {
    e.preventDefault();
    if (!team || !seasonName.trim()) return;
    if (!confirm(`Start "${seasonName.trim()}"? New matches and trainings will go into it. Old seasons stay available.`)) return;
    await run(async () => { const id = await startSeason(team.id, seasonName.trim()); await reload(); setSeasonId(id); setSeasonName(""); }, "New season started");
  }

  async function backup() {
    if (!team) return;
    await run(async () => {
      const data = await exportTeam(team.id);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = `${team.name.replace(/[^\w-]+/g, "_")}-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl tracking-wide">SETTINGS</h1>
      <p role="status" className="text-sm text-green-400 min-h-5">{note}</p>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-pitch-500">Account</h2>
        <div className="surface p-4 flex items-center gap-3">
          <div className="flex-1 min-w-0"><p className="font-medium truncate">{member.displayName}</p><p className="text-xs text-pitch-500 truncate">{email}</p></div>
          <Badge variant={member.role}>{member.role}</Badge>
        </div>
        <button className="btn-ghost flex items-center gap-2" onClick={async () => { await signOut(); router.replace("/login"); }}><LogOut className="w-4 h-4" />Sign out</button>
      </section>

      {isOwner && (
        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-widest text-pitch-500">Club name</h2>
          <form onSubmit={rename} className="flex gap-2">
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            <button className="btn-primary">Save</button>
          </form>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-pitch-500">Seasons</h2>
        <div className="surface divide-y divide-white/5">
          {seasons.map((s) => (
            <button key={s.id} onClick={() => setSeasonId(s.id)} className="w-full flex items-center justify-between px-4 py-3 text-sm text-left">
              <span>{s.name}</span>
              <span className="flex gap-2">{s.isActive && <Badge variant="yes">current</Badge>}{season?.id === s.id && <Badge>viewing</Badge>}</span>
            </button>
          ))}
        </div>
        {isOwner && (
          <form onSubmit={newSeason} className="flex gap-2">
            <input className="input-field" placeholder="New season, e.g. 2026/27" value={seasonName} onChange={(e) => setSeasonName(e.target.value)} maxLength={40} />
            <button className="btn-primary whitespace-nowrap">Start</button>
          </form>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-pitch-500">Coaching staff</h2>
        <ul className="surface divide-y divide-white/5">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="flex-1 truncate">{m.displayName}</span><Badge variant={m.role}>{m.role}</Badge>
              {isOwner && m.userId !== userId && (
                <button aria-label={`Remove ${m.displayName}`} className="p-1.5 text-pitch-500 hover:text-red-400"
                  onClick={() => confirm(`Remove ${m.displayName}?`) && run(async () => { await removeMember(team.id, m.userId); await refresh(); })}><Trash2 className="w-4 h-4" /></button>
              )}
            </li>
          ))}
        </ul>
        {isOwner && (
          <>
            <div className="flex gap-2">
              {(["coach", "staff"] as const).map((role) => (
                <button key={role} className="surface-2 px-3 py-2 text-sm flex-1"
                  onClick={() => run(async () => { if (!userId) return; await createInvite(team.id, role, userId); await refresh(); })}>
                  + Invite {role}
                </button>
              ))}
            </div>
            {invites.map((i) => (
              <div key={i.code} className="surface p-3 flex items-center gap-3 text-sm">
                <code className="flex-1 font-mono tracking-wider">{i.code}</code>
                <Badge variant={i.role}>{i.role}</Badge>
                <button aria-label="Copy code" className="p-1.5 text-pitch-400 hover:text-white" onClick={async () => say((await copyText(i.code)) ? "Code copied" : "Couldn't copy")}><Copy className="w-4 h-4" /></button>
                <button aria-label="Delete invite" className="p-1.5 text-pitch-500 hover:text-red-400" onClick={() => run(async () => { await deleteInvite(i.code); await refresh(); })}><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            {invites.length > 0 && <p className="text-xs text-pitch-500">Send the code; they choose “Join with code” on the sign-in page. Valid for 7 days, one use.</p>}
          </>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-pitch-500">Backup</h2>
        <p className="text-xs text-pitch-500">The free Supabase plan has no automatic backups. Download one now and then.</p>
        <button className="btn-primary flex items-center gap-2" onClick={backup}><Download className="w-4 h-4" />Download backup (JSON)</button>
      </section>
    </div>
  );
}
