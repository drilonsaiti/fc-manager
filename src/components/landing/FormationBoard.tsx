"use client";
import { useState } from "react";
import { getFormation } from "@/features/lineup/formations";
import { useT } from "@/i18n";

const SHAPES = ["4-4-2", "4-3-3", "3-5-2", "4-2-3-1", "5-3-2"] as const;

/** The dots are the same 11 elements in every shape, so changing formation makes them walk to their new spots. */
export function FormationBoard() {
  const { t } = useT();
  const [shape, setShape] = useState<(typeof SHAPES)[number]>("4-3-3");
  const slots = getFormation(shape)!.slots;
  return (
    <div>
      <div className="lp-pitch" aria-hidden>
        <div className="mid" /><div className="circ" /><div className="box t" /><div className="box b" />
        {slots.map((s, i) => (
          <span key={i} className={`lp-dot${s.role === "GK" ? " gk" : ""}`}
            style={{ left: `${s.x}%`, top: `${s.y}%`, "--k": i } as React.CSSProperties}>{i + 1}</span>
        ))}
      </div>
      <div className="lp-chips" role="group" aria-label={t("lp.board.eyebrow")}>
        {SHAPES.map((s) => (
          <button key={s} type="button" aria-pressed={shape === s} onClick={() => setShape(s)}>{s}</button>
        ))}
      </div>
    </div>
  );
}
