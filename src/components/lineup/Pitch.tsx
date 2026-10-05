"use client";
import { forwardRef, type ReactNode } from "react";

/** Portrait pitch, capped so the pitch and the squad list fit on a phone screen together (needed for dragging).
 *  Children are positioned in percent (x: left→right, y: attack at top → own goal at bottom). */
export const Pitch = forwardRef<HTMLDivElement, { children?: ReactNode }>(function Pitch({ children }, ref) {
  return (
    <div ref={ref} className="relative mx-auto aspect-[2/3] w-[min(100%,28rem,calc(54dvh*0.6667))] md:w-[min(100%,30rem,calc(78dvh*0.6667))] rounded-xl overflow-hidden select-none touch-pan-y"
      style={{ background: "repeating-linear-gradient(0deg,#14532d 0 10%,#166534 10% 20%)" }}>
      <svg viewBox="0 0 100 150" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden>
        <g fill="none" stroke="rgba(255,255,255,.55)" strokeWidth=".5">
          <rect x="3" y="3" width="94" height="144" />
          <line x1="3" y1="75" x2="97" y2="75" />
          <circle cx="50" cy="75" r="10" />
          <rect x="22" y="3" width="56" height="22" /><rect x="36" y="3" width="28" height="9" />
          <rect x="22" y="125" width="56" height="22" /><rect x="36" y="138" width="28" height="9" />
        </g>
      </svg>
      {children}
    </div>
  );
});
