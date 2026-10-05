"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { createTeam, joinTeam } from "@/lib/db/teams";
import { friendlyError } from "@/lib/db/util";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils/cn";

type Mode = "signin" | "create" | "join";

const TABS: { id: Mode; label: string }[] = [
  { id: "signin", label: "Sign in" },
  { id: "create", label: "New club" },
  { id: "join", label: "Join with code" },
];

export default function LoginPage() {
  const { userId, member, loading, loadError, reload, signOut } = useAuth();
  const router = useRouter();
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
        if (!name.trim()) throw new Error("Enter your name.");
        if (mode === "create") { if (!club.trim()) throw new Error("Enter your club name."); await createTeam(club.trim(), name.trim()); }
        else { if (!code.trim()) throw new Error("Enter the invite code."); await joinTeam(code.trim(), name.trim()); }
      } else if (mode === "signin") {
        const { error: err } = await auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
      } else {
        if (!name.trim()) throw new Error("Enter your name.");
        if (mode === "create" && !club.trim()) throw new Error("Enter your club name.");
        if (mode === "join" && !code.trim()) throw new Error("Enter the invite code.");
        const { data, error: err } = await auth.signUp({ email: email.trim(), password });
        if (err) throw err;
        if (!data.session) {
          throw new Error("Email not confirmed. Turn off “Confirm email” in Supabase → Authentication → Providers → Email.");
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
          <p className="text-pitch-400 text-sm mt-1">Squad, lineup and availability in minutes.</p>
        </div>

        <div className="grid grid-cols-3 gap-1 p-1 surface-2 mb-4" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={mode === t.id}
              onClick={() => { setMode(t.id); setError(""); }}
              className={cn("py-2 rounded-lg text-xs font-medium transition-colors",
                mode === t.id ? "bg-white text-black" : "text-pitch-400 hover:text-white")}>
              {t.label}
            </button>
          ))}
        </div>

        {!loading && userId && !member && (
          <div role="status" className="surface p-4 mb-4 text-sm space-y-2">
            <p className="text-amber-400 font-medium">You&apos;re signed in, but this account has no club yet.</p>
            {loadError && <p className="text-red-400">Couldn&apos;t load your club: {loadError}</p>}
            <p className="text-pitch-300">Choose <strong>New club</strong> or <strong>Join with code</strong> below to finish setting up.</p>
            <button type="button" className="underline text-pitch-400" onClick={() => signOut()}>Use a different account</button>
          </div>
        )}

        <form onSubmit={submit} className="surface p-5 space-y-3">
          {mode !== "signin" && (
            <input className="input-field" placeholder="Your name" value={name} autoComplete="name"
              onChange={(e) => setName(e.target.value)} maxLength={60} />
          )}
          {mode === "create" && (
            <input className="input-field" placeholder="Club name" value={club}
              onChange={(e) => setClub(e.target.value)} maxLength={60} />
          )}
          {mode === "join" && (
            <input className="input-field font-mono tracking-wider" placeholder="Invite code" value={code}
              onChange={(e) => setCode(e.target.value)} autoCapitalize="none" autoComplete="off" />
          )}
          {!(userId && mode !== "signin") && (
            <>
              <input className="input-field" type="email" placeholder="Email" value={email} required
                autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
              <input className="input-field" type="password" placeholder="Password (6+ characters)" value={password}
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
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "create" ? "Create club" : "Join club"}
          </button>
        </form>

        <p className="text-pitch-500 text-xs text-center mt-4">
          Players don&apos;t need an account — you share a link with them.
        </p>
      </div>
    </main>
  );
}
