"use client";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useT } from "@/i18n";
import { prefersReducedMotion } from "./hooks";

const START = 300; // five minutes, in seconds
const STEPS = [255, 170, 80, 15]; // seconds left when each checklist item turns on

/** Counts down five minutes while the four setup steps tick off, then flashes "Kick-off" and starts over. */
export function MatchClock({ run }: { run: boolean }) {
  const { t } = useT();
  const [left, setLeft] = useState(START);
  const [ko, setKo] = useState(false);

  useEffect(() => {
    if (!run || prefersReducedMotion()) return;
    let timer: ReturnType<typeof setTimeout>;
    let secs = START;
    const tick = () => {
      secs -= 3; // 100 ms of wall time per 3 s of clock: the whole run takes ~10 s
      if (secs <= 0) {
        setLeft(0); setKo(true);
        timer = setTimeout(() => { secs = START; setKo(false); setLeft(START); timer = setTimeout(tick, 1400); }, 3200);
        return;
      }
      setLeft(secs);
      timer = setTimeout(tick, 100);
    };
    timer = setTimeout(tick, 1600);
    return () => clearTimeout(timer);
  }, [run]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const items = (["lp.clock.1", "lp.clock.2", "lp.clock.3", "lp.clock.4"] as const).map((k, i) => ({ k, on: left <= STEPS[i] }));
  return (
    <div className="lp-clock" role="img" aria-label={t("lp.clock.title")}>
      <div className="top"><span>{t("lp.clock.title")}</span></div>
      <div className={`dig${ko ? " ko" : ""}`}>{ko ? t("lp.clock.ko") : `${mm}:${ss}`}</div>
      <ul>
        {items.map(({ k, on }) => (
          <li key={k} className={on ? "on" : ""}><i><Check strokeWidth={4} /></i>{t(k)}</li>
        ))}
      </ul>
    </div>
  );
}
