"use client";
import { useState } from "react";
import { getFormation } from "@/features/lineup/formations";
import { FORMAT_KEYS, FORMATS, type GameFormat } from "@/features/formats/config";
import { useT } from "@/i18n";

/** Demonstrates the pitch editor across supported team formats. */
export function FormationBoard() {
  const { t } = useT();
  const [format, setFormat] = useState<GameFormat>("11v11");
  const [selectedShape, setShape] = useState("4-3-3");
  const shapes = FORMATS[format].formations;
  const shape = shapes.includes(selectedShape) ? selectedShape : shapes[0];
  const slots = getFormation(shape, format)!.slots;
  return (
    <div>
      <div className="lp-pitch" aria-hidden>
        <div className="mid" /><div className="circ" /><div className="box t" /><div className="box b" />
        {slots.map((s, i) => (
          <span key={i} className={`lp-dot${s.role === "GK" ? " gk" : ""}`}
            style={{ left: `${s.x}%`, top: `${s.y}%`, "--k": i } as React.CSSProperties}>{i + 1}</span>
        ))}
      </div>
      <div className="lp-chips" role="group" aria-label={t("fmt.label")}>
        {FORMAT_KEYS.map((key) => <button key={key} type="button" aria-pressed={format === key}
          onClick={() => { setFormat(key); setShape(FORMATS[key].formations[0]); }}>{t(`fmt.${key}` as "fmt.11v11")}</button>)}
      </div>
      <div className="lp-chips" role="group" aria-label={t("lp.board.eyebrow")}>
        {shapes.map((s) => (
          <button key={s} type="button" aria-pressed={shape === s} onClick={() => setShape(s)}>{s}</button>
        ))}
      </div>
    </div>
  );
}
