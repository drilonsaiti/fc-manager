import type { ReactNode } from "react";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-xs text-pitch-400 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-pitch-500 mt-1">{hint}</span>}
    </label>
  );
}
