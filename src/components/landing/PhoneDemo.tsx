"use client";
import { useState } from "react";
import { useT } from "@/i18n";

type Pick = "y" | "m" | "n";

/** A working miniature of the public availability page. */
export function PhoneDemo() {
  const { t } = useT();
  const [pick, setPick] = useState<Pick | null>(null);
  const press = (p: Pick) => setPick((cur) => (cur === p ? null : p));
  const btn = (p: Pick, label: string) => (
    <button type="button" className={p} aria-pressed={pick === p} onClick={() => press(p)}>{label}</button>
  );
  return (
    <div>
      <div className="lp-phone">
        <div className="notch" />
        <div className="scr">
          <small>{t("lp.phone.when")}</small>
          <h4>Rovers FC</h4>
          <div className={`opts${pick ? " picked" : ""}`}>
            {btn("y", t("pub.yes"))}{btn("m", t("pub.maybe"))}{btn("n", t("pub.no"))}
          </div>
          <div className="tally"><span>{t("lp.phone.in")}</span><b>{12 + (pick === "y" ? 1 : 0)}</b></div>
        </div>
      </div>
      <p className="lp-hint">{t("lp.phone.hint")}</p>
    </div>
  );
}
