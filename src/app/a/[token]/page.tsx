"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Check, HelpCircle, X } from "lucide-react";
import { formatKickoff } from "@/features/availability/logic";
import { PageLoader } from "@/components/ui/LoadingSpinner";
import { cn } from "@/lib/utils/cn";
import type { AvailabilityStatus, PublicEvent } from "@/types";

type Load = { state: "loading" } | { state: "missing" } | { state: "error" } | { state: "ready"; event: PublicEvent };

const OPTIONS: { status: AvailabilityStatus; label: string; icon: typeof Check; tone: string }[] = [
  { status: "yes", label: "I can play", icon: Check, tone: "bg-green-500 text-black" },
  { status: "maybe", label: "Maybe", icon: HelpCircle, tone: "bg-amber-400 text-black" },
  { status: "no", label: "Can't make it", icon: X, tone: "bg-red-500 text-white" },
];

const since = (t: number) => Date.now() - t;

const label = (kind: PublicEvent["kind"], s: AvailabilityStatus) =>
  s === "yes" ? (kind === "match" ? "You're in" : "You're coming") : s === "maybe" ? "Marked as maybe" : "Marked as not available";

export default function PublicAvailabilityPage() {
  const { token } = useParams<{ token: string }>();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [me, setMe] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AvailabilityStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [trap, setTrap] = useState("");
  const shownAt = useRef(0);
  const storeKey = `fcm:player:${token}`;

  useEffect(() => {
    shownAt.current = Date.now();
    let cancelled = false;
    fetch(`/api/public/${token}`, { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) return setLoad({ state: "missing" });
        if (!res.ok) return setLoad({ state: "error" });
        const event = (await res.json()) as PublicEvent;
        setLoad({ state: "ready", event });
        try {
          const saved = localStorage.getItem(storeKey);
          if (saved && event.roster.some((p) => p.id === saved)) setMe(saved);
        } catch { /* storage can be blocked; the page still works */ }
      })
      .catch(() => { if (!cancelled) setLoad({ state: "error" }); });
    return () => { cancelled = true; };
  }, [token, storeKey]);

  function choose(id: string | null) {
    setMe(id);
    setAnswer(null);
    setError("");
    try { if (id) localStorage.setItem(storeKey, id); else localStorage.removeItem(storeKey); } catch { /* ignore */ }
  }

  async function send(status: AvailabilityStatus) {
    if (!me || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/public/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: me, status, website: trap, elapsedMs: since(shownAt.current) }),
      });
      if (res.ok) setAnswer(status);
      else if (res.status === 409) setError("The coach has closed answers for this one.");
      else if (res.status === 429) setError("Too many taps. Wait a minute and try again.");
      else setError("Couldn't save. Check your connection and tap again.");
    } catch {
      setError("Couldn't save. Check your connection and tap again.");
    } finally {
      setBusy(false);
    }
  }

  if (load.state === "loading") return <PageLoader />;
  if (load.state !== "ready") {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">{load.state === "missing" ? "Link not found" : "Can't load right now"}</h1>
        <p className="text-pitch-400 text-sm mt-2">
          {load.state === "missing" ? "Ask your coach for a new link." : "Check your connection and reload the page."}
        </p>
      </Shell>
    );
  }

  const { event } = load;
  const player = event.roster.find((p) => p.id === me);

  return (
    <Shell>
      <p className="text-pitch-400 text-xs uppercase tracking-widest">{event.team}</p>
      <h1 className="font-display text-4xl tracking-wide mt-1">{event.title}</h1>
      <p className="text-pitch-300 text-sm mt-1">{formatKickoff(new Date(event.startsAt))}</p>
      {event.place && <p className="text-pitch-400 text-sm">📍 {event.place}</p>}

      <div className="mt-6">
        {event.closed ? (
          <p className="surface p-4 text-sm text-pitch-300">Answers are closed for this one.</p>
        ) : !player ? (
          <>
            <p className="text-sm text-pitch-300 mb-3">Who are you?</p>
            {event.roster.length === 0 ? (
              <p className="text-pitch-400 text-sm">The squad is empty. Ask your coach.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2">
                {event.roster.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => choose(p.id)}
                      className="w-full surface-2 px-4 py-3.5 text-left flex items-center gap-3 active:scale-[0.98] transition-transform">
                      <span className="w-8 text-pitch-500 text-sm tabular-nums">{p.number ?? ""}</span>
                      <span className="font-medium">{p.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-pitch-300 mb-3">
              Hi <strong className="text-white">{player.name}</strong> —{" "}
              <button className="underline text-pitch-400" onClick={() => choose(null)}>not you?</button>
            </p>
            <div className="grid gap-3">
              {OPTIONS.map(({ status, label: text, icon: Icon, tone }) => (
                <button key={status} disabled={busy} onClick={() => send(status)}
                  aria-pressed={answer === status}
                  className={cn("rounded-2xl py-5 text-lg font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition",
                    tone, answer && answer !== status && "opacity-30", busy && "opacity-60")}>
                  <Icon className="w-6 h-6" />{text}
                </button>
              ))}
            </div>
            {answer && <p role="status" className="mt-4 text-center text-green-400 font-medium">✓ {label(event.kind, answer)}. You can change it any time.</p>}
            {error && <p role="alert" className="mt-4 text-center text-red-400 text-sm">{error}</p>}
          </>
        )}
      </div>

      {/* Honeypot: invisible to people, tempting to bots */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label>Website<input tabIndex={-1} autoComplete="off" name="website" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-pitch-950 flex justify-center p-5">
      <div className="w-full max-w-sm pt-8 relative">{children}</div>
    </main>
  );
}
