"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { LANGS, setLang, trIn, useT, type Lang } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { Lines } from "./Lines";
import { FormationBoard } from "./FormationBoard";
import { MatchClock } from "./MatchClock";
import { PhoneDemo } from "./PhoneDemo";
import { prefersReducedMotion, useReveal, useScrollFx } from "./hooks";
import "./landing.css";

const FEATS = [1, 2, 3, 4, 5] as const;
const TICKS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const BUBBLES = [1, 2, 3, 4, 5, 6] as const;

function Ball() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="12" cy="12" r="10" /><path d="m12 7 4.3 3.1-1.6 5H9.3l-1.6-5L12 7Z" />
      <path d="M12 7V2M16.3 10.1l5-1.6M14.7 15.1l3 4.1M9.3 15.1l-3 4.1M7.7 10.1l-5-1.6" />
    </svg>
  );
}

function PitchLines() {
  // A half-ruled pitch, drawn as paths so the strokes can "draw themselves" in.
  return (
    <svg className="lines" viewBox="0 0 1200 800" aria-hidden preserveAspectRatio="xMidYMid meet">
      <rect x="40" y="40" width="1120" height="720" pathLength="1" />
      <path d="M600 40V760" pathLength="1" />
      <circle cx="600" cy="400" r="110" pathLength="1" />
      <path d="M40 220H210V580H40M1160 220H990V580H1160" pathLength="1" />
      <path d="M40 320H100V480H40M1160 320H1100V480H1160" pathLength="1" />
      <circle className="spot" cx="600" cy="400" r="6" />
    </svg>
  );
}

export function Landing() {
  const { t, lang } = useT();
  const { userId, member, loading } = useAuth();
  const root = useRef<HTMLDivElement>(null);
  const [minute, setMinute] = useState(0);
  const [phase, setPhase] = useState<"loading" | "out" | "done">("loading");
  const signedIn = !loading && !!userId && !!member;
  const app = signedIn ? "/dashboard" : "/login";

  // The `js` class is what hides [data-r] items; without JS the page stays fully readable.
  useEffect(() => { root.current?.classList.add("js"); }, []);

  // Loader: a match minute counting 0 → 90 while the page settles, then the curtain lifts.
  useEffect(() => {
    if (prefersReducedMotion()) { const id = setTimeout(() => setPhase("done"), 0); return () => clearTimeout(id); }
    let raf = 0;
    const t0 = performance.now();
    const DUR = 1500;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / DUR);
      setMinute(Math.round(90 * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
      else {
        setTimeout(() => setPhase("out"), 150);
        setTimeout(() => setPhase("done"), 1150);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const ready = phase !== "loading";
  useReveal(root, ready);
  useScrollFx(root);

  useEffect(() => {
    document.documentElement.style.overflow = phase === "loading" || phase === "out" ? "hidden" : "";
    return () => { document.documentElement.style.overflow = ""; };
  }, [phase]);

  return (
    <div ref={root} className="lp">
      {phase !== "done" && (
        <div className={`lp-loader${phase === "out" ? " out" : ""}`} aria-hidden>
          <div className="inner">
            <div className="display mark">FC Manager</div>
            <div className="min">{minute}&prime;</div>
            <div className="bar"><i style={{ transform: `scaleX(${minute / 90})` }} /></div>
          </div>
        </div>
      )}

      <header className="lp-nav">
        <Link href="/" className="lp-brand"><Ball />FC Manager</Link>
        <nav className="links" aria-label="Sections">
          <a href="#features">{t("lp.nav.features")}</a>
          <a href="#how">{t("lp.nav.how")}</a>
        </nav>
        <div className="right">
          <LangSwitch />
          {!signedIn && <Link href="/login" className="lp-pill ghost hide-sm">{t("lp.signin")}</Link>}
          <Link href={signedIn ? "/dashboard" : "/login?mode=create"} className="lp-pill card hide-xs">
            {signedIn ? t("lp.open") : t("lp.start")}
          </Link>
        </div>
      </header>

      <main>
        <section className={`lp-hero${ready ? " in" : ""}`}>
          <div className="grass" /><div className="shade" /><PitchLines />
          <div className="copy">
            <span className="lp-eyebrow">{t("lp.hero.eyebrow")}</span>
            <h1 className="display" aria-label={`${t("lp.hero.l1")} ${t("lp.hero.l2a")} ${t("lp.hero.l2b")}`}>
              <span aria-hidden>
                <span className="mask"><span className="ln" style={{ transform: ready ? "none" : "translateY(112%)", transition: "transform 1.1s var(--ease) .1s" }}>{t("lp.hero.l1")}</span></span>
                <span className="mask"><span className="ln" style={{ transform: ready ? "none" : "translateY(112%)", transition: "transform 1.1s var(--ease) .24s" }}>
                  <span className="outline">{t("lp.hero.l2a")}</span> <span className="yellow">{t("lp.hero.l2b")}</span>
                </span></span>
              </span>
            </h1>
          </div>
          <div className="foot">
            <div>
              <p className="sub" data-r style={{ "--d": "500ms" } as React.CSSProperties}>{t("lp.hero.sub")}</p>
              <div className="ctas" data-r style={{ "--d": "650ms" } as React.CSSProperties}>
                <Link href={signedIn ? "/dashboard" : "/login?mode=create"} className="lp-pill card">
                  {signedIn ? t("lp.open") : t("lp.start")} <ArrowRight className="arr" size={16} />
                </Link>
                <a href="#how" className="lp-pill ghost">{t("lp.hero.cta2")}</a>
              </div>
            </div>
            <div className="clockwrap" data-r style={{ "--d": "800ms" } as React.CSSProperties}>
              <MatchClock run={ready} />
            </div>
          </div>
        </section>

        <div className="lp-ticker" aria-hidden>
          <div className="run">
            {[0, 1].map((k) => <div key={k} style={{ display: "flex" }}>{TICKS.map((n) => <span key={n}>{t(`lp.tick.${n}` as const)}</span>)}</div>)}
          </div>
        </div>

        <section className="lp-why">
          <div className="wrap">
            <span className="lp-eyebrow dark" data-r>{t("lp.why.eyebrow")}</span>
            <h2 className="display"><Lines lines={[t("lp.why.t1"), t("lp.why.t2")]} /></h2>
            <div className="grid">
              <div className="lp-chat">
                {BUBBLES.map((n, i) => (
                  <p key={n} data-r style={{ "--d": `${i * 90}ms` } as React.CSSProperties}>{t(`lp.why.b${n}` as const)}</p>
                ))}
              </div>
              <div className="lp-fix" data-r>
                <h3 className="display">{t("lp.why.fixTitle")}</h3>
                <p>{t("lp.why.fixBody")}</p>
                <div className="link"><b />fcmanager.app/a/k3x9…</div>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-feat" id="features">
          <div className="wrap">
            <span className="lp-eyebrow dark" data-r>{t("lp.feat.eyebrow")}</span>
            <h2 className="display"><Lines lines={[t("lp.feat.t1"), t("lp.feat.t2")]} /></h2>
            <ul>
              {FEATS.map((n) => (
                <li key={n} data-r>
                  <div className="lp-row">
                    <span className="n">0{n}</span>
                    <h3 className="display">{t(`lp.feat.${n}n` as const)}</h3>
                    <p>{t(`lp.feat.${n}d` as const)}</p>
                    <span className="go"><ArrowUpRight /></span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lp-board">
          <div className="wrap grid">
            <div>
              <span className="lp-eyebrow" data-r>{t("lp.board.eyebrow")}</span>
              <h2 className="display"><Lines lines={[t("lp.board.t1"), t("lp.board.t2")]} /></h2>
              <p className="body" data-r>{t("lp.board.body")}</p>
            </div>
            <div data-r><FormationBoard /></div>
          </div>
        </section>

        <section className="lp-how" id="how">
          <div className="wrap">
            <span className="lp-eyebrow dark" data-r>{t("lp.how.eyebrow")}</span>
            <h2 className="display"><Lines lines={[t("lp.how.t1"), t("lp.how.t2")]} /></h2>
            <div className="grid">
              <ol className="lp-steps">
                {([1, 2, 3] as const).map((n, i) => (
                  <li key={n} data-r style={{ "--d": `${i * 100}ms` } as React.CSSProperties}>
                    <div><h3 className="display">{t(`lp.how.${n}n` as const)}</h3><p>{t(`lp.how.${n}d` as const)}</p></div>
                  </li>
                ))}
              </ol>
              <div data-r><PhoneDemo /></div>
            </div>
          </div>
        </section>

        <section className="lp-lang">
          <div className="wrap">
            <span className="lp-eyebrow" data-r>{t("lp.lang.eyebrow")}</span>
            <h2 className="display"><Lines lines={[t("lp.lang.t1"), t("lp.lang.t2")]} /></h2>
            <p className="body" data-r>{t("lp.lang.body")}</p>
            <div className="rows">
              {LANGS.map((l, i) => (
                <button key={l.id} type="button" className="row" data-r style={{ "--d": `${i * 100}ms` } as React.CSSProperties}
                  aria-pressed={lang === l.id} lang={l.id} onClick={() => setLang(l.id as Lang)}>
                  <span className="code">{l.id.toUpperCase()}</span>
                  <span className="phrase">{trIn(l.id, "lp.hero.l1")} {trIn(l.id, "lp.hero.l2a")} {trIn(l.id, "lp.hero.l2b")}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-num">
          <div className="wrap">
            <dl>
              {([["0", 1], ["1", 2], ["3", 3], ["1", 4]] as const).map(([v, n], i) => (
                <div key={n} data-r style={{ "--d": `${i * 90}ms` } as React.CSSProperties}>
                  <dd>{v}</dd><dt>{t(`lp.num.${n}` as const)}</dt>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="lp-cta">
          <div className="wrap">
            <h2 className="display"><Lines lines={[t("lp.cta.t1"), t("lp.cta.t2")]} /></h2>
            {/*<p data-r>{t("lp.cta.body")}</p>*/}
            <div className="row" data-r>
              <Link href={signedIn ? "/dashboard" : "/login?mode=create"} className="lp-pill yellowbtn">
                {signedIn ? t("lp.open") : t("lp.cta.btn")} <ArrowRight className="arr" size={16} />
              </Link>
              {!signedIn && <Link href="/login" className="plain">{t("lp.cta.signin")}</Link>}
            </div>
          </div>
        </section>
      </main>

      <footer><div className="wrap"><span>{t("lp.foot")}</span><Link href={app}>{signedIn ? t("lp.open") : t("lp.signin")}</Link></div></footer>
    </div>
  );
}
