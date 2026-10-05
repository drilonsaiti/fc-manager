"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, KeyRound, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createTeam, joinTeam } from "@/lib/db/teams";
import { friendlyError } from "@/lib/db/util";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils/cn";
import { Modal } from "./Modal";
import { Field } from "./Field";

/**
 * Current team with a menu to switch (U19, U17 …), add a team or join one with an invite code.
 * With a single team it still shows the name, plus the "add" actions.
 */
export function TeamSwitcher({ className }: { className?: string }) {
  const { t } = useT();
  const router = useRouter();
  const { team, teams, member, reload, switchTeam } = useAuth();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<"new" | "join" | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  function pick(id: string) {
    setOpen(false);
    if (id === team?.id) return;
    switchTeam(id);
    router.push("/dashboard");
  }

  function show(kind: "new" | "join") {
    setOpen(false); setValue(""); setError(""); setDialog(kind);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!member || busy) return;
    const text = value.trim();
    if (!text) return setError(t(dialog === "new" ? "team.errName" : "login.errCode"));
    setBusy(true); setError("");
    try {
      const id = dialog === "new" ? (await createTeam(text, member.displayName)).teamId : await joinTeam(text, member.displayName);
      await reload();
      switchTeam(id);
      setDialog(null);
      router.push("/dashboard");
    } catch (err) {
      setError(friendlyError(err, t("f.errSave")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={box} className={cn("relative min-w-0", className)}>
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={t("team.switch")}
        className="flex items-center gap-1.5 max-w-full rounded-lg px-2 py-1 -mx-2 hover:bg-white/5 active:bg-white/10">
        <span className="font-display text-xl md:text-2xl tracking-wide truncate">{team?.name ?? "FC MANAGER"}</span>
        <ChevronDown className={cn("w-4 h-4 shrink-0 text-pitch-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div role="menu" className="absolute left-0 top-full mt-2 w-64 max-w-[85vw] z-50 surface border border-white/10 shadow-2xl rounded-xl p-1.5 animate-slide-up">
          {teams.map(({ team: x, member: m }) => (
            <button key={x.id} role="menuitemradio" aria-checked={x.id === team?.id} onClick={() => pick(x.id)}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left hover:bg-white/5">
              <span className="flex-1 min-w-0 truncate">{x.name}</span>
              <span className="text-[11px] text-pitch-500">{t(`role.${m.role}`)}</span>
              {x.id === team?.id && <Check className="w-4 h-4" />}
            </button>
          ))}
          <div className="my-1 border-t border-white/10" />
          <button role="menuitem" onClick={() => show("new")} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left hover:bg-white/5">
            <Plus className="w-4 h-4" />{t("team.new")}
          </button>
          <button role="menuitem" onClick={() => show("join")} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left hover:bg-white/5">
            <KeyRound className="w-4 h-4" />{t("team.join")}
          </button>
        </div>
      )}

      <Modal open={dialog !== null} onClose={() => setDialog(null)} title={dialog === "join" ? t("team.join") : t("team.new")} size="sm">
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-pitch-400">{dialog === "join" ? t("s.inviteHelp") : t("team.help")}</p>
          <Field label={dialog === "join" ? t("team.codeLabel") : t("team.name")}>
            <input className="input-field" value={value} autoFocus maxLength={dialog === "join" ? 40 : 80}
              placeholder={dialog === "new" ? t("team.namePh") : ""} onChange={(e) => setValue(e.target.value)} />
          </Field>
          {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn-ghost" onClick={() => setDialog(null)}>{t("c.cancel")}</button>
            <button className="btn-primary disabled:opacity-60" disabled={busy}>{busy ? t("c.saving") : dialog === "join" ? t("team.joinBtn") : t("team.create")}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
