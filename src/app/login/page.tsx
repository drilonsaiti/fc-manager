"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { createTeam, joinTeam } from "@/lib/db/teams";
import { friendlyError } from "@/lib/db/util";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils/cn";
import { useT, type MessageKey } from "@/i18n";
import { LangSwitch } from "@/components/ui/LangSwitch";

type Mode = "signin" | "create" | "join";

const TABS: { id: Mode; label: MessageKey }[] = [
  { id: "signin", label: "login.signin" },
  { id: "create", label: "login.newClub" },
  { id: "join", label: "login.join" },
];

export default function LoginPage() {
  const { userId, member, loading, loadError, reload, signOut } = useAuth();
  const router = useRouter();
  const { t } = useT();
  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [club, setClub] = useState("");
  const [code, setCode] = useState("");
  const [trap, setTrap] = useState(""); // honeypot: people never see or fill this
  const shownAt = useRef(0);

  useEffect(() => { shownAt.current = Date.now(); }, []);

  useEffect(() => {
    if (!loading && userId && member) router.replace("/dashboard");
  }, [loading, userId, member, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");

    // Bots: pretend to work, do nothing. (Supabase Auth has its own rate limits on top.)
    if (trap.trim() !== "" || Date.now() - shownAt.current < 1200) {
      setBusy(true);
      setTimeout(() => setBusy(false), 1500);
      return;
    }

    setBusy(true);
    try {
      const auth = supabase().auth;
      if (userId && mode !== "signin") {
        // Already signed in (e.g. the account was made earlier but the club step failed): only the club is missing.
        if (!name.trim()) throw new Error(t("login.errName"));
        if (mode === "create") { if (!club.trim()) throw new Error(t("login.errClub")); await createTeam(club.trim(), name.trim()); }
        else { if (!code.trim()) throw new Error(t("login.errCode")); await joinTeam(code.trim(), name.trim()); }
      } else if (mode === "signin") {
        const { error: err } = await auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
      } else {
        if (!name.trim()) throw new Error(t("login.errName"));
        if (mode === "create" && !club.trim()) throw new Error(t("login.errClub"));
        if (mode === "join" && !code.trim()) throw new Error(t("login.errCode"));
        const { data, error: err } = await auth.signUp({ email: email.trim(), password });
        if (err) throw err;
        if (!data.session) {
          throw new Error("Email not confirmed");
        }
        if (mode === "create") await createTeam(club.trim(), name.trim());
        else await joinTeam(code.trim(), name.trim());
      }
      await reload();
      router.replace("/dashboard");
    } catch (err) {
      setError(friendlyError(err, err instanceof Error ? err.message : undefined));
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-pitch-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-5xl tracking-wide">FC MANAGER</h1>
          <p className="text-pitch-400 text-sm mt-1">{t("login.tagline")}</p>
          <LangSwitch className="mt-4" />
        </div>

        <div className="grid grid-cols-3 gap-1 p-1 surface-2 mb-4" role="tablist">
          {TABS.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={mode === tab.id}
              onClick={() => { setMode(tab.id); setError(""); }}
              className={cn("py-2 rounded-lg text-xs font-medium transition-colors",
                mode === tab.id ? "bg-white text-black" : "text-pitch-400 hover:text-white")}>
              {t(tab.label)}
            </button>
          ))}
        </div>

        {!loading && userId && !member && (
          <div role="status" className="surface p-4 mb-4 text-sm space-y-2">
            <p className="text-amber-400 font-medium">{t("login.noClub")}</p>
            {loadError && <p className="text-red-400">{t("login.loadFail", { error: loadError })}</p>}
            <p className="text-pitch-300">{t("login.noClubHelp")}</p>
            <button type="button" className="underline text-pitch-400" onClick={() => signOut()}>{t("login.otherAccount")}</button>
          </div>
        )}

        <form onSubmit={submit} className="surface p-5 space-y-3">
          {mode !== "signin" && (
            <input className="input-field" placeholder={t("login.name")} value={name} autoComplete="name"
              onChange={(e) => setName(e.target.value)} maxLength={60} />
          )}
          {mode === "create" && (
            <input className="input-field" placeholder={t("login.club")} value={club}
              onChange={(e) => setClub(e.target.value)} maxLength={60} />
          )}
          {mode === "join" && (
            <input className="input-field font-mono tracking-wider" placeholder={t("login.code")} value={code}
              onChange={(e) => setCode(e.target.value)} autoCapitalize="none" autoComplete="off" />
          )}
          {!(userId && mode !== "signin") && (
            <>
              <input className="input-field" type="email" placeholder={t("login.email")} value={email} required
                autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
              <input className="input-field" type="password" placeholder={t("login.password")} value={password}
                required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"}
                onChange={(e) => setPassword(e.target.value)} />
            </>
          )}

          {/* Honeypot */}
          <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
            <label>Website<input tabIndex={-1} autoComplete="off" name="website" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>
          </div>

          {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
          <button className="btn-primary w-full py-3 disabled:opacity-60" disabled={busy}>
            {busy ? t("c.wait") : mode === "signin" ? t("login.signin") : mode === "create" ? t("login.btnCreate") : t("login.btnJoin")}
          </button>
        </form>

        <p className="text-pitch-500 text-xs text-center mt-4">
          {t("login.playersNote")}
        </p>
      </div>
    </main>
  );
}
