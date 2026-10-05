import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { MatchReport } from "./report";

const CARD = { yellow: "Yellow card", red: "Red card", second_yellow: "Second yellow (sent off)" } as const;

/** Builds the PDF in memory. Standard PDF fonts have no emoji, so the PDF uses plain words. */
export function buildReportPdf(r: MatchReport): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 16;
  let y = 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(110);
  doc.text("MATCH REPORT", W / 2, y, { align: "center" });

  y += 14;
  doc.setTextColor(20);
  doc.setFontSize(26);
  doc.text(`${r.home.score}  -  ${r.away.score}`, W / 2, y, { align: "center" });
  doc.setFontSize(13);
  doc.text(r.home.name, W / 2 - 24, y, { align: "right" });
  doc.text(r.away.name, W / 2 + 24, y, { align: "left" });

  y += 9;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`${r.result} · ${r.meta}`, W / 2, y, { align: "center", maxWidth: W - 2 * M });
  y += 8;

  const section = (title: string, head: string[], body: string[][]) => {
    if (body.length === 0) return;
    if (y > 255) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(title, M, y);
    autoTable(doc, {
      startY: y + 3,
      head: [head],
      body,
      margin: { left: M, right: M },
      theme: "striped",
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontSize: 9 },
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 16 } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;
  };

  section("Goals", ["Min", "Goal"], r.goals.map((g) => [`${g.minute}'`, g.forTeam === "them" ? `${g.text} (opponent)` : g.text]));
  section("Cards", ["Min", "Card"], r.cards.map((c) => [`${c.minute}'`, `${c.player} - ${CARD[c.kind]}`]));
  section("Substitutions", ["Min", "Substitution"], r.subs.map((s) => [`${s.minute}'`, `${s.off}  >  ${s.on}`]));
  section("Starting XI", ["No.", "Player", "Position"], r.startingXI.map((p) => [p.number != null ? String(p.number) : "-", p.name, p.label]));
  section("Bench", ["No.", "Player", "Played"], r.bench.map((p) => [p.number != null ? String(p.number) : "-", p.name, p.played ? "Came on" : "Unused"]));

  if (r.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(20);
    doc.text("Notes", M, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60);
    doc.text(doc.splitTextToSize(r.notes, W - 2 * M), M, y + 6);
  }
  return doc;
}

export function reportFileName(r: MatchReport): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug(r.home.name)}-vs-${slug(r.away.name)}.pdf`;
}
