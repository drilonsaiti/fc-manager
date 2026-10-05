"use client";
import { useMemo, useState } from "react";
import { Copy, Download, Printer } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEvents, useLineup } from "@/hooks/data";
import { setMatchNotes } from "@/lib/db/matches";
import { friendlyError } from "@/lib/db/util";
import { buildReport, reportToText } from "@/features/report/report";
import { copyText } from "@/lib/utils/clipboard";
import { reportLabels } from "@/i18n/labels";
import { useT } from "@/i18n";
import type { Match, Player } from "@/types";

export function ReportView({ match, players, teamName, onChange }: { match: Match; players: Player[]; teamName: string; onChange: () => void }) {
  const { t, locale } = useT();
  const { canManage } = useAuth();
  const { lineup } = useLineup(match.id);
  const { events } = useEvents(match.id);
  const [notes, setNotes] = useState(match.notes ?? "");
  const [note, setNote] = useState("");

  const labels = useMemo(() => reportLabels(t), [t]);
  const report = useMemo(() => buildReport({
    teamName, match, events, lineup, locale, labels,
    players: new Map(players.map((p) => [p.id, { name: p.name, number: p.number }])),
  }), [teamName, match, events, lineup, players, locale, labels]);

  const say = (t: string) => { setNote(t); setTimeout(() => setNote(""), 2500); };

  async function pdf() {
    try {
      const [{ buildReportPdf, reportFileName }, fonts] = await Promise.all([import("@/features/report/pdf"), loadPdfFonts()]);
      buildReportPdf(report, labels, fonts).save(reportFileName(report));
    } catch { say(t("r.noPdf")); }
  }

  async function saveNotes() {
    try { await setMatchNotes(match.id, notes); onChange(); say(t("r.notesSaved")); } catch (e) { say(friendlyError(e)); }
  }

  const final = match.status === "final";

  return (
    <section className="space-y-5 print:text-black" aria-label={t("tab.report")}>
      <div className="surface p-5 text-center">
        <p className="text-xs uppercase tracking-widest text-pitch-500">{final ? labels.result[report.result] : t("r.preview")}</p>
        <p className="font-display text-3xl tracking-wide mt-1">{report.home.name} {report.home.score} – {report.away.score} {report.away.name}</p>
        <p className="text-xs text-pitch-400 mt-1">{report.meta}</p>
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        <button className="btn-primary flex items-center gap-2" onClick={pdf}><Download className="w-4 h-4" />{t("r.pdf")}</button>
        <button className="surface-2 px-4 py-2 text-sm flex items-center gap-2" onClick={async () => say((await copyText(reportToText(report, labels))) ? t("r.copiedText") : t("c.copyFail"))}><Copy className="w-4 h-4" />{t("r.copyText")}</button>
        <button className="surface-2 px-4 py-2 text-sm flex items-center gap-2" onClick={() => window.print()}><Printer className="w-4 h-4" />{t("r.print")}</button>
      </div>
      <p role="status" className="text-xs text-green-400 min-h-4">{note}</p>

      {report.goals.length > 0 && <Block title={t("r.goals")}>{report.goals.map((g, i) => <li key={i}>{g.minute}&apos; — {g.text} <span className="text-pitch-500">({g.forTeam === "us" ? teamName : match.opponent})</span></li>)}</Block>}
      {report.cards.length > 0 && <Block title={t("r.cards")}>{report.cards.map((c, i) => <li key={i}>{c.minute}&apos; — {c.kind === "yellow" ? "🟨" : c.kind === "red" ? "🟥" : "🟨🟥"} {c.player}</li>)}</Block>}
      {report.subs.length > 0 && <Block title={t("r.subs")}>{report.subs.map((s, i) => <li key={i}>{s.minute}&apos; — {s.on} ➜ {s.off}</li>)}</Block>}
      {report.startingXI.length > 0 && <Block title={t("r.xi")}>{report.startingXI.map((p, i) => <li key={i}><span className="text-pitch-500 tabular-nums">{p.number ?? "–"}</span> {p.name} <span className="text-pitch-500 text-xs">{p.label}</span></li>)}</Block>}
      {report.bench.length > 0 && <Block title={t("r.bench")}>{report.bench.map((p, i) => <li key={i}><span className="text-pitch-500 tabular-nums">{p.number ?? "–"}</span> {p.name}{p.played ? " ✓" : ""}</li>)}</Block>}

      <div className="print:hidden">
        <h3 className="text-xs uppercase tracking-widest text-pitch-500 mb-2">{t("r.notes")}</h3>
        {canManage ? (
          <>
            <textarea className="input-field" rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("r.notesPh")} />
            <button className="btn-ghost mt-2" onClick={saveNotes} disabled={notes === (match.notes ?? "")}>{t("r.saveNotes")}</button>
          </>
        ) : <p className="text-sm text-pitch-300">{match.notes || "—"}</p>}
      </div>
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-widest text-pitch-500 mb-2">{title}</h3>
      <ul className="surface divide-y divide-white/5 text-sm [&>li]:px-4 [&>li]:py-2">{children}</ul>
    </div>
  );
}

/** Roboto (regular + bold) as base64, fetched once. Needed for Cyrillic in the PDF. */
let fontCache: Promise<{ regular: string; bold: string }> | null = null;
function loadPdfFonts() {
  fontCache ??= (async () => {
    const get = async (file: string) => {
      const res = await fetch(`/fonts/${file}`);
      if (!res.ok) throw new Error("font");
      const bytes = new Uint8Array(await res.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    };
    const [regular, bold] = await Promise.all([get("Roboto_400Regular.ttf"), get("Roboto_700Bold.ttf")]);
    return { regular, bold };
  })();
  fontCache.catch(() => { fontCache = null; });
  return fontCache;
}
