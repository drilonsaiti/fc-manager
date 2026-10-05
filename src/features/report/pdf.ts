import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { EN_REPORT_LABELS, type MatchReport, type ReportLabels } from "./report";

/** Base64 TTF data. Standard PDF fonts lack Cyrillic, so the app passes Roboto (regular + bold). */
export interface PdfFonts { regular: string; bold: string }

/** Builds the PDF in memory. Standard PDF fonts have no emoji, so the PDF uses plain words. */
export function buildReportPdf(r: MatchReport, labels: ReportLabels = EN_REPORT_LABELS, fonts?: PdfFonts): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const CARD = { yellow: labels.yellow, red: labels.red, second_yellow: labels.secondYellow } as const;
  let family = "helvetica";
  if (fonts) {
    doc.addFileToVFS("Roboto-Regular.ttf", fonts.regular);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.addFileToVFS("Roboto-Bold.ttf", fonts.bold);
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
    family = "Roboto";
  }
  const W = doc.internal.pageSize.getWidth();
  const M = 16;
  let y = 22;

  doc.setFont(family, "bold");
  doc.setFontSize(11);
  doc.setTextColor(110);
  doc.text(labels.matchReport, W / 2, y, { align: "center" });

  y += 14;
  doc.setTextColor(20);
  doc.setFontSize(26);
  doc.text(`${r.home.score}  -  ${r.away.score}`, W / 2, y, { align: "center" });
  doc.setFontSize(13);
  doc.text(r.home.name, W / 2 - 24, y, { align: "right" });
  doc.text(r.away.name, W / 2 + 24, y, { align: "left" });

  y += 9;
  doc.setFont(family, "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`${labels.result[r.result]} · ${r.meta}`, W / 2, y, { align: "center", maxWidth: W - 2 * M });
  y += 8;

  const section = (title: string, head: string[], body: string[][]) => {
    if (body.length === 0) return;
    if (y > 255) { doc.addPage(); y = 20; }
    doc.setFont(family, "bold");
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(title, M, y);
    autoTable(doc, {
      startY: y + 3,
      head: [head],
      body,
      margin: { left: M, right: M },
      theme: "striped",
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontSize: 9, font: family },
      styles: { font: family, fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 16 } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;
  };

  section(labels.goals, [labels.min, labels.goal], r.goals.map((g) => [`${g.minute}'`, g.forTeam === "them" ? `${g.text} (${labels.opponent})` : g.text]));
  section(labels.cards, [labels.min, labels.card], r.cards.map((c) => [`${c.minute}'`, `${c.player} - ${CARD[c.kind]}`]));
  section(labels.subs, [labels.min, labels.substitution], r.subs.map((s) => [`${s.minute}'`, `${s.off}  >  ${s.on}`]));
  section(labels.startingXI, [labels.no, labels.player, labels.position], r.startingXI.map((p) => [p.number != null ? String(p.number) : "-", p.name, p.label]));
  section(labels.bench, [labels.no, labels.player, labels.played], r.bench.map((p) => [p.number != null ? String(p.number) : "-", p.name, p.played ? labels.cameOn : labels.unused]));

  if (r.notes) {
    doc.setFont(family, "bold");
    doc.setFontSize(10);
    doc.setTextColor(20);
    doc.text(labels.notes, M, y);
    doc.setFont(family, "normal");
    doc.setTextColor(60);
    doc.text(doc.splitTextToSize(r.notes, W - 2 * M), M, y + 6);
  }
  return doc;
}

export function reportFileName(r: MatchReport): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
  return `${slug(r.home.name)}-vs-${slug(r.away.name)}.pdf`;
}
