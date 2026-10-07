import type { CSSProperties, ElementType, ReactNode } from "react";

/** Headline whose lines slide up out of a mask, one after the other. Needs `useReveal` on an ancestor. */
export function Lines({ as: Tag = "span", lines, delay = 0, className }: {
  as?: ElementType; lines: ReactNode[]; delay?: number; className?: string;
}) {
  return (
    <Tag data-l="" className={className} style={{ "--d": `${delay}ms` } as CSSProperties}>
      {lines.map((l, i) => (
        <span className="mask" key={i}><span className="ln" style={{ "--i": i } as CSSProperties}>{l}</span></span>
      ))}
    </Tag>
  );
}
