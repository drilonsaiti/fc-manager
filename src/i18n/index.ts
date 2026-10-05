"use client";
import { useCallback, useSyncExternalStore } from "react";
import { en, type MessageKey } from "./en";
import { sq } from "./sq";
import { mk } from "./mk";

export type Lang = "en" | "sq" | "mk";
export type { MessageKey };

export const LANGS: { id: Lang; label: string; locale: string }[] = [
  { id: "en", label: "English", locale: "en-GB" },
  { id: "sq", label: "Shqip", locale: "sq-AL" },
  { id: "mk", label: "Македонски", locale: "mk-MK" },
];

const DICT: Record<Lang, Record<string, string>> = { en, sq, mk };
const STORAGE_KEY = "fcm:lang";

const isLang = (v: unknown): v is Lang => v === "en" || v === "sq" || v === "mk";

/** Saved choice first, then the phone's language, then English. */
export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch { /* storage may be blocked */ }
  for (const l of typeof navigator === "undefined" ? [] : navigator.languages ?? [navigator.language]) {
    const base = l.toLowerCase().split("-")[0];
    if (base === "sq") return "sq";
    if (base === "mk") return "mk";
    if (base === "en") return "en";
  }
  return "en";
}

let current: Lang | null = null;
const listeners = new Set<() => void>();

export function getLang(): Lang {
  if (typeof window === "undefined") return "en";
  if (current === null) current = detectLang();
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  if (typeof document !== "undefined") document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

export const getLocale = (): string => LANGS.find((l) => l.id === getLang())!.locale;

export type Params = Record<string, string | number>;

/** Translate. Works anywhere; components should call useT() so they re-render when the language changes. */
export function tr(key: MessageKey, params?: Params): string {
  return fill(DICT[getLang()][key] ?? en[key] ?? key, params);
}

/** Like tr() for keys built at runtime (e.g. "pos.Striker"); falls back to the given text. */
export function trDyn(key: string, fallback: string): string {
  return DICT[getLang()][key] ?? (en as Record<string, string>)[key] ?? fallback;
}

export function fill(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, () => "en" as Lang);
}

export function useT() {
  const lang = useLang();
  const t = useCallback((key: MessageKey, params?: Params) => fill(DICT[lang][key] ?? en[key] ?? key, params), [lang]);
  return { t, lang, locale: LANGS.find((l) => l.id === lang)!.locale };
}
