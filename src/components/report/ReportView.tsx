"use client";
import { useMemo, useState } from "react";
import { Copy, Download, Printer } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEvents, useLineup } from "@/hooks/data";
import { setMatchNotes } from "@/lib/db/matches";
import { friendlyError } from "@/lib/db/util";
import { buildReport, reportToText } from "@/features/report/report";
import { copyText } from "@/lib/utils/clipboard";
import type { Match, Player } from "@/types";

export function ReportView({ match, players, teamName, onChange }: { match: Match; players: Player[]; teamName: string; onChange: () => void }) {
  const { canManage } = useAuth();
  const { lineup } = useLineup(match.id);
  const { events } = useEvents(match.id);
  const [notes, setNotes] = useState(match.notes ?? "");
  const [note, setNote] = useState("");

  const report = useMemo(() => buildReport({
    teamName, match, events, lineup,
    players: new Map(players.map((p) => [p.id, { name: p.name, number: p.number }])),
  }), [teamName, match, events, lineup, players]);

  const say = (t: string) => { setNote(t); setTimeout(() => setNote(""), 2500); };

  async function pdf() {
    try {
      const { buildReportPdf, reportFileName } = await import("@/features/report/pdf");
      buildReportPdf(report).save(reportFileName(report));
    } catch { say("Couldn't create the PDF."); }
  }

  async function saveNotes() {
    try { await setMatchNotes(match.id, notes); onChange(); say("Notes saved"); } catch (e) { say(friendlyError(e)); }
  }

  const final = match.status === "final";

  return (
    <section className="space-y-5 print:text-black" aria-label="Match report">
      <div className="surface p-5 text-center">
        <p className="text-xs uppercase tracking-widest text-pitch-500">{final ? report.result : "Report preview"}</p>
        <p className="font-display text-3xl tracking-wide mt-1">{report.home.name} {report.home.score} – {report.away.score} {report.away.name}</p>
        <p className="text-xs text-pitch-400 mt-1">{report.meta}</p>
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        <button className="btn-primary flex items-center gap-2" onClick={pdf}><Download className="w-4 h-4" />PDF</button>
        <button className="surface-2 px-4 py-2 text-sm flex items-center gap-2" onClick={async () => say((await copyText(reportToText(report))) ? "Report copied — paste it in the group chat" : "Couldn't copy")}><Copy className="w-4 h-4" />Copy text</button>
        <button className="surface-2 px-4 py-2 text-sm flex items-center gap-2" onClick={() => window.print()}><Printer className="w-4 h-4" />Print</button>
      </div>
      <p role="status" className="text-xs text-green-400 min-h-4">{note}</p>

      {report.goals.length > 0 && <Block title="Goals">{report.goals.map((g, i) => <li key={i}>{g.minute}&apos; — {g.text} <span className="text-pitch-500">({g.forTeam === "us" ? teamName : match.opponent})</span></li>)}</Block>}
      {report.cards.length > 0 && <Block title="Cards">{report.cards.map((c, i) => <li key={i}>{c.minute}&apos; — {c.kind === "yellow" ? "🟨" : c.kind === "red" ? "🟥" : "🟨🟥"} {c.player}</li>)}</Block>}
      {report.subs.length > 0 && <Block title="Substitutions">{report.subs.map((s, i) => <li key={i}>{s.minute}&apos; — {s.on} on, {s.off} off</li>)}</Block>}
      {report.startingXI.length > 0 && <Block title="Starting XI">{report.startingXI.map((p, i) => <li key={i}><span className="text-pitch-500 tabular-nums">{p.number ?? "–"}</span> {p.name} <span className="text-pitch-500 text-xs">{p.label}</span></li>)}</Block>}
      {report.bench.length > 0 && <Block title="Bench">{report.bench.map((p, i) => <li key={i}><span className="text-pitch-500 tabular-nums">{p.number ?? "–"}</span> {p.name}{p.played ? " ✓" : ""}</li>)}</Block>}

      <div className="print:hidden">
        <h3 className="text-xs uppercase tracking-widest text-pitch-500 mb-2">Coach&apos;s notes</h3>
        {canManage ? (
          <>
            <textarea className="input-field" rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it go?" />
            <button className="btn-ghost mt-2" onClick={saveNotes} disabled={notes === (match.notes ?? "")}>Save notes</button>
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
