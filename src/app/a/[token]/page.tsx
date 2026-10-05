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

/** "Who am I" for a team, remembered on this phone only. A convenience, never proof of identity. */
interface Remembered { id: string; code: string | null }
const memKey = (teamId: string) => `fcm:me:${teamId}`;
function readMemory(teamId: string): Remembered | null {
  try {
    const v = JSON.parse(localStorage.getItem(memKey(teamId)) ?? "null") as Remembered | null;
    return v && typeof v.id === "string" ? { id: v.id, code: typeof v.code === "string" ? v.code : null } : null;
  } catch { return null; }
}
function writeMemory(teamId: string, v: Remembered) { try { localStorage.setItem(memKey(teamId), JSON.stringify(v)); } catch { /* ignore */ } }
function forgetMemory(teamId: string) { try { localStorage.removeItem(memKey(teamId)); } catch { /* ignore */ } }

const savedKey = (kind: PublicEvent["kind"], s: AvailabilityStatus): MessageKey =>
  s === "yes" ? (kind === "match" ? "pub.savedYesMatch" : "pub.savedYesTraining") : s === "maybe" ? "pub.savedMaybe" : "pub.savedNo";

export default function PublicAvailabilityPage() {
  const { token } = useParams<{ token: string }>();
  const { t, locale } = useT();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [me, setMe] = useState<string | null>(null);
  /** Personal code from the link (?p=) or remembered on this phone. It travels with every answer. */
  const [code, setCode] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AvailabilityStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [trap, setTrap] = useState("");
  const shownAt = useRef(0);

  useEffect(() => {
    shownAt.current = Date.now();
    let cancelled = false;
    const load = async (c: string | null) => {
      const res = await fetch(`/api/public/${token}${c ? `?p=${c}` : ""}`, { cache: "no-store" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("load");
      return (await res.json()) as PublicEvent;
    };
    (async () => {
      try {
        const fromLink = new URLSearchParams(window.location.search).get("p");
        const first = await load(fromLink);
        if (cancelled) return;
        if (!first) return setLoad({ state: "missing" });
        let event = first;
        let known = event.me ? { id: event.me.id, code: fromLink } : null;

        // Not identified by the link: this phone may remember who this is (any link of this team).
        if (!known) {
          const saved = readMemory(event.teamId);
          if (saved?.code) {
            const again = await load(saved.code);
            if (cancelled) return;
            if (again?.me) { event = again; known = { id: again.me.id, code: saved.code }; }
            else forgetMemory(event.teamId);
          } else if (saved && event.roster.some((p) => p.id === saved.id)) {
            known = { id: saved.id, code: null };
          }
        }
        if (known) { setMe(known.id); setCode(known.code); writeMemory(event.teamId, known); }
        setLoad({ state: "ready", event });
      } catch {
        if (!cancelled) setLoad({ state: "error" });
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  function choose(id: string | null) {
    setMe(id);
    setCode(null);
    setAnswer(null);
    setError("");
    if (load.state === "ready") { if (id) writeMemory(load.event.teamId, { id, code: null }); else forgetMemory(load.event.teamId); }
  }

  async function send(status: AvailabilityStatus) {
    if (!me || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/public/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: me, status, code, website: trap, elapsedMs: since(shownAt.current) }),
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
  const player = event.me && event.me.id === me ? event.me : event.roster.find((p) => p.id === me);
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
        ) : !player && event.strict ? (
          <p className="surface p-4 text-sm text-pitch-300">{t("pub.personalOnly")}</p>
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
              {!code && <button className="underline text-pitch-400" onClick={() => choose(null)}>{t("pub.notYou")}</button>}
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
