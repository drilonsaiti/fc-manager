export interface LineupImageInput {
  title: string;
  subtitle: string;
  formation: string;
  starters: { x: number; y: number; number: number | null; name: string }[];
  bench: { number: number | null; name: string }[];
  benchTitle: string;
  footer: string;
}

const W = 1080;
const PITCH_W = 936;
const PITCH_H = 1404; // 2:3, same shape as the on-screen pitch
const FONT = '"DM Sans", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

const surname = (name: string) => name.trim().split(/\s+/).slice(-1)[0];

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

/** Height needed for the whole image (the bench list wraps onto as many rows as it needs). */
export function lineupImageHeight(benchCount: number): number {
  const rows = Math.ceil(benchCount / 3);
  return 190 + PITCH_H + 60 + (benchCount ? 70 + rows * 64 : 0) + 90;
}

export function drawLineup(ctx: CanvasRenderingContext2D, input: LineupImageInput): void {
  const H = lineupImageHeight(input.bench.length);
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, W, H);

  // header
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 54px ${FONT}`;
  ctx.fillText(fitText(ctx, input.title, W - 80), W / 2, 84);
  ctx.fillStyle = "#9a9a9a";
  ctx.font = `400 30px ${FONT}`;
  ctx.fillText(fitText(ctx, input.subtitle, W - 80), W / 2, 130);
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText(input.formation, W / 2, 176);

  // pitch
  const px = (W - PITCH_W) / 2;
  const py = 200;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(px, py, PITCH_W, PITCH_H, 28);
  ctx.clip();
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 ? "#166534" : "#14532d";
    ctx.fillRect(px, py + (PITCH_H / 10) * i, PITCH_W, PITCH_H / 10 + 1);
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,.6)";
  ctx.lineWidth = 4;
  const sx = PITCH_W / 100, sy = PITCH_H / 150;
  const rect = (x: number, y: number, w: number, h: number) => ctx.strokeRect(px + x * sx, py + y * sy, w * sx, h * sy);
  rect(3, 3, 94, 144);
  ctx.beginPath(); ctx.moveTo(px + 3 * sx, py + 75 * sy); ctx.lineTo(px + 97 * sx, py + 75 * sy); ctx.stroke();
  ctx.beginPath(); ctx.arc(px + 50 * sx, py + 75 * sy, 10 * sx, 0, Math.PI * 2); ctx.stroke();
  rect(22, 3, 56, 22); rect(36, 3, 28, 9); rect(22, 125, 56, 22); rect(36, 138, 28, 9);

  // players
  for (const p of input.starters) {
    const cx = px + (p.x / 100) * PITCH_W;
    const cy = py + (p.y / 100) * PITCH_H;
    ctx.beginPath();
    ctx.arc(cx, cy, 38, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
    ctx.fill();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = "#050505";
    ctx.font = `700 34px ${FONT}`;
    ctx.textBaseline = "middle";
    ctx.fillText(p.number != null ? String(p.number) : "•", cx, cy + 2);

    ctx.font = `600 27px ${FONT}`;
    const label = fitText(ctx, surname(p.name), 170);
    const tw = ctx.measureText(label).width + 22;
    ctx.fillStyle = "rgba(0,0,0,.6)";
    ctx.beginPath(); ctx.roundRect(cx - tw / 2, cy + 46, tw, 40, 10); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, cx, cy + 67);
  }

  // bench
  let y = py + PITCH_H + 60;
  if (input.bench.length) {
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillStyle = "#9a9a9a";
    ctx.font = `700 28px ${FONT}`;
    ctx.fillText(input.benchTitle.toUpperCase(), px, y + 20);
    y += 50;
    const colW = PITCH_W / 3;
    input.bench.forEach((b, i) => {
      const x = px + (i % 3) * colW;
      const yy = y + Math.floor(i / 3) * 64;
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath(); ctx.roundRect(x, yy, colW - 14, 52, 12); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 26px ${FONT}`;
      ctx.textBaseline = "middle";
      ctx.fillText(b.number != null ? String(b.number) : "–", x + 14, yy + 27);
      ctx.font = `500 26px ${FONT}`;
      ctx.fillText(fitText(ctx, surname(b.name), colW - 90), x + 62, yy + 27);
    });
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#555555";
  ctx.font = `400 24px ${FONT}`;
  ctx.fillText(input.footer, W / 2, H - 36);
}

/** Renders the lineup to a PNG. Browser only. */
export function lineupImageBlob(input: LineupImageInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = lineupImageHeight(input.bench.length);
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("canvas unavailable"));
  drawLineup(ctx, input);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"));
}

export function imageFileName(team: string, opponent: string): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
  return `lineup-${slug(team)}-vs-${slug(opponent)}.png`;
}
