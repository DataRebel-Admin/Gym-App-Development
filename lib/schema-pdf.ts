import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type SchemaPdfData = {
  tenantName: string;
  logoUrl: string | null;
  memberName: string;
  schemaName: string;
  items: {
    exercise: string;
    machine: string | null;
    sets: number;
    reps: number;
  }[];
};

// Helvetica (WinAnsi) ondersteunt geen × of en-dash; vervang door ASCII.
const ascii = (s: string) => s.replace(/×/g, "x").replace(/[–—]/g, "-");

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const GRAY = rgb(0.45, 0.45, 0.45);
const BLACK = rgb(0.1, 0.1, 0.1);
const LINE = rgb(0.8, 0.8, 0.8);

const COLS = [
  { label: "Oefening", x: MARGIN, max: 28 },
  { label: "Machine", x: MARGIN + 160, max: 20 },
  { label: "Sets", x: MARGIN + 280 },
  { label: "Reps", x: MARGIN + 320 },
  { label: "Gewicht (kg)", x: MARGIN + 365 },
  { label: "Gedaan", x: MARGIN + 450 },
];

export async function buildSchemaPdf(data: SchemaPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage(A4);
  const width = A4[0];
  const height = A4[1];
  let y = height - MARGIN;

  // --- Header ---
  page.drawText(ascii(data.tenantName), {
    x: MARGIN,
    y,
    size: 18,
    font: bold,
    color: BLACK,
  });
  y -= 22;
  page.drawText(ascii(data.schemaName), { x: MARGIN, y, size: 14, font: bold, color: BLACK });
  y -= 16;
  const dateStr = new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  page.drawText(`${ascii(data.memberName)}  -  ${dateStr}`, {
    x: MARGIN,
    y,
    size: 10,
    font,
    color: GRAY,
  });
  y -= 28;

  function hline(yy: number) {
    page.drawLine({
      start: { x: MARGIN, y: yy },
      end: { x: width - MARGIN, y: yy },
      thickness: 0.5,
      color: LINE,
    });
  }

  function drawTableHeader() {
    hline(y + 6);
    for (const c of COLS) {
      page.drawText(c.label, { x: c.x, y, size: 9, font: bold, color: GRAY });
    }
    y -= 6;
    hline(y);
    y -= 18;
  }
  drawTableHeader();

  // --- Rijen ---
  for (const it of data.items) {
    if (y < MARGIN + 70) {
      page = doc.addPage(A4);
      y = height - MARGIN;
      drawTableHeader();
    }
    page.drawText(ascii(it.exercise).slice(0, COLS[0].max), {
      x: COLS[0].x,
      y,
      size: 10,
      font,
      color: BLACK,
    });
    page.drawText(ascii(it.machine ?? "lichaamsgewicht").slice(0, COLS[1].max!), {
      x: COLS[1].x,
      y,
      size: 9,
      font,
      color: GRAY,
    });
    page.drawText(String(it.sets), { x: COLS[2].x, y, size: 10, font, color: BLACK });
    page.drawText(String(it.reps), { x: COLS[3].x, y, size: 10, font, color: BLACK });
    // Lege invulvelden (handmatig).
    page.drawLine({
      start: { x: COLS[4].x, y: y - 2 },
      end: { x: COLS[4].x + 70, y: y - 2 },
      thickness: 0.5,
      color: LINE,
    });
    page.drawLine({
      start: { x: COLS[5].x, y: y - 2 },
      end: { x: COLS[5].x + 45, y: y - 2 },
      thickness: 0.5,
      color: LINE,
    });
    y -= 22;
    hline(y + 8);
  }

  // --- Footer op elke pagina ---
  const safety = "Bij twijfel: vraag een trainer.";
  for (const p of doc.getPages()) {
    p.drawLine({
      start: { x: MARGIN, y: MARGIN + 24 },
      end: { x: width - MARGIN, y: MARGIN + 24 },
      thickness: 0.5,
      color: LINE,
    });
    p.drawText(safety, { x: MARGIN, y: MARGIN + 10, size: 10, font: bold, color: BLACK });
    const tn = ascii(data.tenantName);
    p.drawText(tn, {
      x: width - MARGIN - bold.widthOfTextAtSize(tn, 9),
      y: MARGIN + 10,
      size: 9,
      font,
      color: GRAY,
    });
  }

  // --- Optioneel tenant-logo rechtsboven ---
  if (data.logoUrl) {
    try {
      const res = await fetch(data.logoUrl);
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        const lower = data.logoUrl.toLowerCase();
        const img = lower.endsWith(".png")
          ? await doc.embedPng(bytes)
          : await doc.embedJpg(bytes);
        const scaled = img.scale(36 / img.height);
        const first = doc.getPages()[0];
        first.drawImage(img, {
          x: width - MARGIN - scaled.width,
          y: height - MARGIN - scaled.height + 14,
          width: scaled.width,
          height: scaled.height,
        });
      }
    } catch {
      // logo overslaan bij fout
    }
  }

  return doc.save();
}
