"use client";
import { Languages } from "lucide-react";
import { LANGS, setLang, useT, type Lang } from "@/i18n";

/** Small language picker. Remembers the choice on this device. */
export function LangSwitch({ className = "" }: { className?: string }) {
  const { t, lang } = useT();
  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <Languages className="w-4 h-4 text-pitch-400 pointer-events-none absolute left-2.5" aria-hidden />
      <span className="sr-only">{t("nav.language")}</span>
      <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}
        className="appearance-none bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-pitch-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
        {LANGS.map((l) => <option key={l.id} value={l.id} className="bg-pitch-900">{l.label}</option>)}
      </select>
    </label>
  );
}
