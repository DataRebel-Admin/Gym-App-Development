import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";

export type SchemaPdfItem = {
  exercise: string;
  machine: string | null;
  sets: number;
  reps: number;
  weightKg: number | null;
  notes: string | null;
};

export type SchemaPdfDay = { name: string; items: SchemaPdfItem[] };

export type SchemaPdfData = {
  tenantName: string;
  accentColor: string | null;
  logoUrl: string | null;
  memberName: string;
  schemaName: string;
  version: string; // bv. een datum-/versielabel
  onlineUrl?: string | null; // QR-doel (optioneel)
  days: SchemaPdfDay[];
};

// Helvetica (WinAnsi) ondersteunt geen × of en-dash; vervang door ASCII.
const ascii = (s: string) => s.replace(/×/g, "x").replace(/[–—]/g, "-");

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const GRAY = rgb(0.45, 0.45, 0.45);
const BLACK = rgb(0.1, 0.1, 0.1);
const LINE = rgb(0.82, 0.82, 0.82);

function hexToRgb(hex: string | null) {
  if (!hex) return rgb(0.1, 0.1, 0.1);
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return rgb(0.1, 0.1, 0.1);
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const COLS = [
  { label: "Oefening", x: MARGIN, max: 26 },
  { label: "Machine", x: MARGIN + 150, max: 18 },
  { label: "Sets", x: MARGIN + 265 },
  { label: "Reps", x: MARGIN + 300 },
  { label: "Kg", x: MARGIN + 340 },
  { label: "Gedaan", x: MARGIN + 470 },
];

export async function buildSchemaPdf(data: SchemaPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const accent = hexToRgb(data.accentColor);
  const width = A4[0];
  const height = A4[1];

  let page = doc.addPage(A4);
  let y = height - MARGIN - 24;

  function hline(yy: number, color = LINE) {
    page.drawLine({ start: { x: MARGIN, y: yy }, end: { x: width - MARGIN, y: yy }, thickness: 0.5, color });
  }

  function newPage() {
    page = doc.addPage(A4);
    y = height - MARGIN - 24;
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

  function ensure(space: number) {
    if (y < MARGIN + 60 + space) newPage();
  }

  // --- Dagen ---
  for (const day of data.days) {
    // Dagkop bij elkaar houden met minstens de tabelkop + eerste rij.
    ensure(70);
    page.drawText(ascii(day.name), { x: MARGIN, y, size: 13, font: bold, color: accent });
    y -= 18;
    drawTableHeader();

    for (const it of day.items) {
      const hasNotes = Boolean(it.notes && it.notes.trim());
      const rowH = hasNotes ? 32 : 22;
      if (y < MARGIN + 70) {
        newPage();
        drawTableHeader();
      }
      page.drawText(ascii(it.exercise).slice(0, COLS[0].max), { x: COLS[0].x, y, size: 10, font, color: BLACK });
      page.drawText(ascii(it.machine ?? "lichaamsgewicht").slice(0, COLS[1].max!), { x: COLS[1].x, y, size: 9, font, color: GRAY });
      page.drawText(String(it.sets), { x: COLS[2].x, y, size: 10, font, color: BLACK });
      page.drawText(String(it.reps), { x: COLS[3].x, y, size: 10, font, color: BLACK });
      page.drawText(it.weightKg != null ? String(it.weightKg) : "____", { x: COLS[4].x, y, size: 10, font, color: it.weightKg != null ? BLACK : GRAY });
      // "Gedaan"-invulvakje.
      page.drawLine({ start: { x: COLS[5].x, y: y - 2 }, end: { x: COLS[5].x + 45, y: y - 2 }, thickness: 0.5, color: LINE });
      if (hasNotes) {
        y -= 12;
        page.drawText(ascii(`Notitie: ${it.notes!.trim()}`).slice(0, 90), { x: COLS[0].x + 8, y, size: 8, font, color: GRAY });
      }
      y -= rowH - 12;
      hline(y + 8);
    }
    y -= 14; // ruimte tussen dagen
  }

  // --- Header (elke pagina) + footer + branding ---
  const dateStr = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const meta = `${ascii(data.memberName)}  -  ${dateStr}  -  versie ${ascii(data.version)}`;
  const safety = "Bij twijfel: vraag een trainer.";
  const pages = doc.getPages();

  for (const p of pages) {
    // Header-balk
    p.drawText(ascii(data.tenantName), { x: MARGIN, y: height - MARGIN, size: 16, font: bold, color: accent });
    p.drawText(ascii(data.schemaName), { x: MARGIN, y: height - MARGIN - 16, size: 11, font, color: GRAY });
    p.drawLine({ start: { x: MARGIN, y: height - MARGIN - 22 }, end: { x: width - MARGIN, y: height - MARGIN - 22 }, thickness: 1, color: accent });
    // Footer
    p.drawLine({ start: { x: MARGIN, y: MARGIN + 24 }, end: { x: width - MARGIN, y: MARGIN + 24 }, thickness: 0.5, color: LINE });
    p.drawText(safety, { x: MARGIN, y: MARGIN + 10, size: 10, font: bold, color: BLACK });
    const tn = ascii(data.tenantName);
    p.drawText(tn, { x: width - MARGIN - font.widthOfTextAtSize(tn, 9), y: MARGIN + 10, size: 9, font, color: GRAY });
  }
  // Meta-regel onder de header op pagina 1.
  pages[0].drawText(meta, { x: MARGIN, y: height - MARGIN - 36, size: 9, font, color: GRAY });

  // --- Tenant-logo rechtsboven (pagina 1) ---
  if (data.logoUrl) {
    try {
      const res = await fetch(data.logoUrl);
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        const img = data.logoUrl.toLowerCase().endsWith(".png")
          ? await doc.embedPng(bytes)
          : await doc.embedJpg(bytes);
        const scaled = img.scale(32 / img.height);
        pages[0].drawImage(img, { x: width - MARGIN - scaled.width, y: height - MARGIN - scaled.height + 12, width: scaled.width, height: scaled.height });
      }
    } catch {
      // logo overslaan bij fout
    }
  }

  // --- QR-code naar de online versie (optioneel, rechtsonder pagina 1) ---
  if (data.onlineUrl) {
    try {
      const dataUrl = await QRCode.toDataURL(data.onlineUrl, { margin: 0, width: 120 });
      const png = await doc.embedPng(Buffer.from(dataUrl.split(",")[1], "base64"));
      const size = 56;
      pages[0].drawImage(png, { x: width - MARGIN - size, y: MARGIN + 34, width: size, height: size });
      pages[0].drawText("Online versie", { x: width - MARGIN - size, y: MARGIN + 26, size: 7, font, color: GRAY });
    } catch {
      // QR overslaan bij fout
    }
  }

  return doc.save();
}
