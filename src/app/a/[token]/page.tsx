"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Check, HelpCircle, X } from "lucide-react";
import { formatKickoff, publicHeading } from "@/features/availability/logic";
import { useT, type MessageKey } from "@/i18n";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { PageLoader } from "@/components/ui/LoadingSpinner";
import { cn } from "@/lib/utils/cn";
import type { AvailabilityStatus, PublicEvent } from "@/types";

type Load = { state: "loading" } | { state: "missing" } | { state: "error" } | { state: "ready"; event: PublicEvent };

const OPTIONS: { status: AvailabilityStatus; label: MessageKey; icon: typeof Check; tone: string }[] = [
  { status: "yes", label: "pub.yes", icon: Check, tone: "bg-green-500 text-black" },
  { status: "maybe", label: "pub.maybe", icon: HelpCircle, tone: "bg-amber-400 text-black" },
  { status: "no", label: "pub.no", icon: X, tone: "bg-red-500 text-white" },
];

const since = (t: number) => Date.now() - t;

const savedKey = (kind: PublicEvent["kind"], s: AvailabilityStatus): MessageKey =>
  s === "yes" ? (kind === "match" ? "pub.savedYesMatch" : "pub.savedYesTraining") : s === "maybe" ? "pub.savedMaybe" : "pub.savedNo";

export default function PublicAvailabilityPage() {
  const { token } = useParams<{ token: string }>();
  const { t, locale } = useT();
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
      else if (res.status === 409) setError(t("pub.errClosed"));
      else if (res.status === 429) setError(t("pub.errRate"));
      else setError(t("pub.errSave"));
    } catch {
      setError(t("pub.errSave"));
    } finally {
      setBusy(false);
    }
  }

  if (load.state === "loading") return <PageLoader />;
  if (load.state !== "ready") {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">{load.state === "missing" ? t("pub.notFound") : t("pub.loadFail")}</h1>
        <p className="text-pitch-400 text-sm mt-2">
          {load.state === "missing" ? t("pub.notFoundHelp") : t("pub.loadFailHelp")}
        </p>
      </Shell>
    );
  }

  const { event } = load;
  const heading = publicHeading(event, {
    vs: t("m.vs"), training: t("tr.single"),
    kinds: { fitness: t("kind.fitness"), technical: t("kind.technical"), tactical: t("kind.tactical"), match_practice: t("kind.match_practice"), other: t("kind.other") },
  });
  const player = event.roster.find((p) => p.id === me);
  const [hiBefore, hiAfter] = t("pub.hi", { name: "\u0000" }).split("\u0000");

  return (
    <Shell>
      <p className="text-pitch-400 text-xs uppercase tracking-widest">{event.team}</p>
      <h1 className="font-display text-4xl tracking-wide mt-1">{heading}</h1>
      <p className="text-pitch-300 text-sm mt-1">{formatKickoff(new Date(event.startsAt), locale)}</p>
      {event.place && <p className="text-pitch-400 text-sm">📍 {event.place}</p>}

      <div className="mt-6">
        {event.closed ? (
          <p className="surface p-4 text-sm text-pitch-300">{t("pub.closed")}</p>
        ) : !player ? (
          <>
            <p className="text-sm text-pitch-300 mb-3">{t("pub.who")}</p>
            {event.roster.length === 0 ? (
              <p className="text-pitch-400 text-sm">{t("pub.emptySquad")}</p>
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
              {hiBefore}<strong className="text-white">{player.name}</strong>{hiAfter}{" "}
              <button className="underline text-pitch-400" onClick={() => choose(null)}>{t("pub.notYou")}</button>
            </p>
            <div className="grid gap-3">
              {OPTIONS.map(({ status, label: text, icon: Icon, tone }) => (
                <button key={status} disabled={busy} onClick={() => send(status)}
                  aria-pressed={answer === status}
                  className={cn("rounded-2xl py-5 text-lg font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition",
                    tone, answer && answer !== status && "opacity-30", busy && "opacity-60")}>
                  <Icon className="w-6 h-6" />{t(text)}
                </button>
              ))}
            </div>
            {answer && <p role="status" className="mt-4 text-center text-green-400 font-medium">✓ {t(savedKey(event.kind, answer))}. {t("pub.canChange")}</p>}
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
      <div className="w-full max-w-sm pt-4 relative">
        <div className="flex justify-end mb-4"><LangSwitch /></div>
        {children}
      </div>
    </main>
  );
}
