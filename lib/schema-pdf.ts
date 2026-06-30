import "server-only";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import QRCode from "qrcode";

export type SchemaPdfItem = {
  exercise: string;
  machine: string | null;
  sets: number;
  reps: number;
  weightKg: number | null;
  restSeconds: number | null;
  tempo?: string | null;
  notes: string | null;
};

export type SchemaPdfDay = { name: string; items: SchemaPdfItem[] };

export type SchemaPdfData = {
  tenantName: string;
  accentColor: string | null;
  secondaryColor?: string | null;
  logoUrl: string | null;
  memberName: string;
  trainerName?: string | null;
  schemaName: string;
  intro?: string | null; // korte introductie / motivatie
  version: string; // versielabel
  createdAt?: Date | null; // aanmaakdatum van het schema
  onlineUrl?: string | null; // QR-doel (optioneel)
  website?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  days: SchemaPdfDay[];
};

/**
 * Helvetica (WinAnsi/cp1252) kan een handvol typografische tekens niet coderen.
 * Dutch-accenten (é, ë, ï, …) blijven behouden; alleen de probleemgevallen
 * normaliseren we naar ASCII zodat embedding nooit faalt.
 */
const sanitize = (s: string) =>
  s
    .replace(/×/g, "x")
    .replace(/[–—]/g, "-")
    .replace(/[•·]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim();

// --- Geometrie -------------------------------------------------------------
const A4: [number, number] = [595.28, 841.89];
const PAGE_W = A4[0];
const PAGE_H = A4[1];
const MARGIN = 42;
const CONTENT_W = PAGE_W - MARGIN * 2;
const CONTENT_TOP = PAGE_H - 132; // start van de inhoud onder de cover-header
const RUNNING_TOP = PAGE_H - 64; // start van de inhoud onder de running-header
const FOOTER_LIMIT = MARGIN + 44; // niets onder deze grens tekenen

// --- Kleur-helpers ---------------------------------------------------------
type Tuple = [number, number, number];

const INK: Tuple = [0.13, 0.15, 0.18];
const SUBTLE: Tuple = [0.42, 0.45, 0.5];
const HAIR: Tuple = [0.87, 0.88, 0.9];
const ZEBRA: Tuple = [0.972, 0.975, 0.98];
const WHITE: Tuple = [1, 1, 1];

const col = (t: Tuple): RGB => rgb(t[0], t[1], t[2]);

function hexToTuple(hex: string | null | undefined, fallback: Tuple): Tuple {
  if (!hex) return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const mix = (a: Tuple, b: Tuple, t: number): Tuple => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

// --- Tekst-helpers ---------------------------------------------------------
function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = sanitize(text).split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxW || !line) {
      line = next;
    } else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Kapt één regel af met een ellipsis als hij niet past. */
function ellipsize(text: string, font: PDFFont, size: number, maxW: number): string {
  const t = sanitize(text);
  if (font.widthOfTextAtSize(t, size) <= maxW) return t;
  let s = t;
  while (s.length > 1 && font.widthOfTextAtSize(`${s}...`, size) > maxW) {
    s = s.slice(0, -1);
  }
  return `${s.trim()}...`;
}

function formatRest(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, "0")}`;
}

// --- Tabel-kolommen --------------------------------------------------------
type ColAlign = "left" | "center";
const RAW_COLS: { key: string; label: string; w: number; align: ColAlign }[] = [
  { key: "ex", label: "Oefening", w: 196, align: "left" },
  { key: "sets", label: "Sets", w: 42, align: "center" },
  { key: "reps", label: "Reps", w: 46, align: "center" },
  { key: "weight", label: "Gewicht", w: 58, align: "center" },
  { key: "rest", label: "Rust", w: 46, align: "center" },
  { key: "tempo", label: "Tempo", w: 42, align: "center" },
];
// Notities-kolom vult de resterende breedte.
const COLS = (() => {
  const used = RAW_COLS.reduce((a, c) => a + c.w, 0);
  return [
    ...RAW_COLS,
    { key: "notes", label: "Notities", w: CONTENT_W - used, align: "left" as ColAlign },
  ];
})();
const colX = (() => {
  const xs: Record<string, number> = {};
  let x = MARGIN;
  for (const c of COLS) {
    xs[c.key] = x;
    x += c.w;
  }
  return xs;
})();

const CELL_PAD = 7;
const NAME_SIZE = 9.5;
const SUB_SIZE = 7.5;
const CELL_SIZE = 9.5;
const NOTE_SIZE = 7.5;

// =========================================================================
export async function buildSchemaPdf(data: SchemaPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${sanitize(data.schemaName)} — ${sanitize(data.memberName)}`);
  doc.setProducer("GymRebel");
  doc.setCreator(sanitize(data.tenantName));

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const accent = hexToTuple(data.accentColor, [0.11, 0.13, 0.16]);
  const secondary = hexToTuple(data.secondaryColor, accent);
  const accentSoft = mix(accent, WHITE, 0.88); // zeer lichte tint voor vlakken

  // Logo eenmalig embedden (kan op meerdere plekken gebruikt worden).
  let logo: PDFImage | null = null;
  if (data.logoUrl) {
    try {
      const res = await fetch(data.logoUrl);
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        logo = data.logoUrl.toLowerCase().endsWith(".png")
          ? await doc.embedPng(bytes)
          : await doc.embedJpg(bytes);
      }
    } catch {
      logo = null;
    }
  }

  const createdStr = new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(data.createdAt ?? new Date());

  let page!: PDFPage;
  let y = 0;

  // ---- Lijn/rechthoek-helpers (op de huidige pagina) ----
  const rect = (x: number, yy: number, w: number, h: number, c: Tuple) =>
    page.drawRectangle({ x, y: yy, width: w, height: h, color: col(c) });
  const hline = (yy: number, c: Tuple, thickness = 0.6, x0 = MARGIN, x1 = PAGE_W - MARGIN) =>
    page.drawLine({ start: { x: x0, y: yy }, end: { x: x1, y: yy }, thickness, color: col(c) });
  const text = (
    s: string,
    x: number,
    yy: number,
    size: number,
    f: PDFFont,
    c: Tuple,
  ) => page.drawText(sanitize(s), { x, y: yy, size, font: f, color: col(c) });
  const textRight = (s: string, xRight: number, yy: number, size: number, f: PDFFont, c: Tuple) => {
    const w = f.widthOfTextAtSize(sanitize(s), size);
    text(s, xRight - w, yy, size, f, c);
  };
  const textCenter = (s: string, cx: number, yy: number, size: number, f: PDFFont, c: Tuple) => {
    const w = f.widthOfTextAtSize(sanitize(s), size);
    text(s, cx - w / 2, yy, size, f, c);
  };

  // ---- Cover-header (pagina 1) ----
  function drawCoverHeader() {
    // Accent-band full-bleed bovenaan.
    page.drawRectangle({ x: 0, y: PAGE_H - 8, width: PAGE_W, height: 8, color: col(accent) });
    page.drawRectangle({ x: 0, y: PAGE_H - 11, width: PAGE_W, height: 3, color: col(secondary) });

    let tx = MARGIN;
    const logoTop = PAGE_H - 26;
    const logoH = 34;
    if (logo) {
      const scaled = logo.scale(logoH / logo.height);
      const w = Math.min(scaled.width, 150);
      const h = (w / scaled.width) * scaled.height;
      page.drawImage(logo, { x: MARGIN, y: logoTop - h, width: w, height: h });
      tx = MARGIN + w + 14;
    }
    // Sportschoolnaam.
    text(data.tenantName, tx, logoTop - 20, 17, bold, accent);
    // Subtiele tagline-regel onder de naam.
    text("Trainingsschema", tx, logoTop - 32, 8.5, font, SUBTLE);

    // Grote schema-titel.
    const titleY = PAGE_H - 84;
    text(data.schemaName, MARGIN, titleY, 21, bold, INK);

    // Meta-strip (lid · trainer · datum · versie).
    const metaY = PAGE_H - 104;
    const parts: { label: string; value: string }[] = [
      { label: "Voor", value: data.memberName },
    ];
    if (data.trainerName) parts.push({ label: "Trainer", value: data.trainerName });
    parts.push({ label: "Aangemaakt", value: createdStr });
    parts.push({ label: "Versie", value: data.version });

    let mx = MARGIN;
    parts.forEach((p, i) => {
      if (i > 0) {
        text("|", mx, metaY, 8.5, font, mix(SUBTLE, WHITE, 0.5));
        mx += font.widthOfTextAtSize("|", 8.5) + 8;
      }
      const lbl = `${p.label}: `;
      text(lbl, mx, metaY, 8.5, font, SUBTLE);
      mx += font.widthOfTextAtSize(lbl, 8.5);
      const val = sanitize(p.value);
      text(val, mx, metaY, 8.5, bold, INK);
      mx += bold.widthOfTextAtSize(val, 8.5) + 8;
    });

    hline(PAGE_H - 116, HAIR, 0.8);
  }

  // ---- Running-header (pagina 2+) ----
  function drawRunningHeader() {
    page.drawRectangle({ x: 0, y: PAGE_H - 5, width: PAGE_W, height: 5, color: col(accent) });
    text(data.tenantName, MARGIN, PAGE_H - 30, 11, bold, accent);
    textRight(data.schemaName, PAGE_W - MARGIN, PAGE_H - 30, 9.5, font, SUBTLE);
    hline(PAGE_H - 40, HAIR, 0.8);
  }

  function newPage(first = false) {
    page = doc.addPage(A4);
    if (first) {
      drawCoverHeader();
      y = CONTENT_TOP;
    } else {
      drawRunningHeader();
      y = RUNNING_TOP;
    }
  }

  // ---- Inhoud opbouwen ----
  newPage(true);

  // Introductie / motivatie (alleen pagina 1).
  if (data.intro && data.intro.trim()) {
    const introLines = wrap(data.intro, italic, 9.5, CONTENT_W - 16);
    const boxH = 14 + introLines.length * 13 + 10;
    rect(MARGIN, y - boxH + 14, CONTENT_W, boxH, accentSoft);
    rect(MARGIN, y - boxH + 14, 3, boxH, accent); // accent-randje links
    let ly = y - 4;
    for (const line of introLines) {
      text(line, MARGIN + 14, ly, 9.5, italic, INK);
      ly -= 13;
    }
    y -= boxH + 8;
  }

  // ---- Tabel-header tekenen ----
  function drawTableHeader(continued = false) {
    const h = 19;
    rect(MARGIN, y - h + 13, CONTENT_W, h, mix(accent, WHITE, 0.9));
    for (const c of COLS) {
      const label = continued && c.key === "ex" ? `${c.label} (vervolg)` : c.label;
      if (c.align === "center") {
        textCenter(label, colX[c.key] + c.w / 2, y, 8, bold, mix(INK, SUBTLE, 0.3));
      } else {
        text(label, colX[c.key] + CELL_PAD, y, 8, bold, mix(INK, SUBTLE, 0.3));
      }
    }
    y -= h + 1;
  }

  // ---- Rij-hoogte schatten ----
  function rowHeight(it: SchemaPdfItem): number {
    const nameLines = wrap(it.exercise, bold, NAME_SIZE, COLS[0].w - CELL_PAD * 2).length;
    const subH = it.machine ? SUB_SIZE + 3 : 0;
    const noteLines = it.notes?.trim()
      ? wrap(it.notes, font, NOTE_SIZE, COLS[6].w - CELL_PAD * 2).length
      : 0;
    const left = nameLines * (NAME_SIZE + 2.5) + subH;
    const right = noteLines * (NOTE_SIZE + 2.5);
    return CELL_PAD * 2 + Math.max(left, right, CELL_SIZE + 2);
  }

  // ---- Eén rij tekenen ----
  function drawRow(it: SchemaPdfItem, index: number) {
    const h = rowHeight(it);
    const top = y;
    const bottom = top - h + 12;
    if (index % 2 === 1) rect(MARGIN, bottom, CONTENT_W, h, ZEBRA);

    // Oefening + machine-subtitel.
    let ny = top - CELL_PAD + 2;
    const nameLines = wrap(it.exercise, bold, NAME_SIZE, COLS[0].w - CELL_PAD * 2);
    for (const ln of nameLines) {
      text(ln, colX.ex + CELL_PAD, ny, NAME_SIZE, bold, INK);
      ny -= NAME_SIZE + 2.5;
    }
    if (it.machine) {
      text(
        ellipsize(it.machine, font, SUB_SIZE, COLS[0].w - CELL_PAD * 2),
        colX.ex + CELL_PAD,
        ny,
        SUB_SIZE,
        font,
        SUBTLE,
      );
    }

    // Numerieke kolommen, verticaal uitgelijnd op de eerste regel.
    const cy = top - CELL_PAD - 1;
    const center = (key: string, s: string, c: Tuple = INK, f: PDFFont = font) =>
      textCenter(s, colX[key] + COLS.find((k) => k.key === key)!.w / 2, cy, CELL_SIZE, f, c);
    center("sets", String(it.sets), INK, bold);
    center("reps", String(it.reps));
    if (it.weightKg != null) center("weight", `${it.weightKg} kg`);
    else center("weight", "____", SUBTLE);
    center("rest", formatRest(it.restSeconds), SUBTLE);
    center("tempo", it.tempo ? sanitize(it.tempo) : "·", SUBTLE);

    // Notities.
    if (it.notes?.trim()) {
      let qy = top - CELL_PAD + 1;
      for (const ln of wrap(it.notes, font, NOTE_SIZE, COLS[6].w - CELL_PAD * 2)) {
        text(ln, colX.notes + CELL_PAD, qy, NOTE_SIZE, font, mix(INK, SUBTLE, 0.4));
        qy -= NOTE_SIZE + 2.5;
      }
    }

    y = bottom;
    hline(y + 11, HAIR, 0.5);
  }

  // ---- Dag-sectiekop ----
  function drawDayHeader(day: SchemaPdfDay, continued = false) {
    const h = 26;
    rect(MARGIN, y - h + 14, CONTENT_W, h, accentSoft);
    rect(MARGIN, y - h + 14, 4, h, accent);
    text(continued ? `${day.name} (vervolg)` : day.name, MARGIN + 14, y - 4, 13, bold, INK);
    const count = `${day.items.length} ${day.items.length === 1 ? "oefening" : "oefeningen"}`;
    textRight(count, PAGE_W - MARGIN - 8, y - 3, 8.5, font, SUBTLE);
    y -= h + 6;
  }

  // ---- Dagen renderen ----
  for (const day of data.days) {
    const dayHeaderH = 32;
    const tableHeaderH = 20;
    const firstRowH = day.items.length ? rowHeight(day.items[0]) : 24;
    const need = dayHeaderH + tableHeaderH + firstRowH;
    const fullPageRoom = RUNNING_TOP - FOOTER_LIMIT;

    // Kop bij elkaar houden: alleen naar nieuwe pagina als het nu niet past
    // maar op een lege pagina wél zou passen.
    if (y - need < FOOTER_LIMIT && need <= fullPageRoom) newPage();

    drawDayHeader(day);
    drawTableHeader();

    day.items.forEach((it, i) => {
      const h = rowHeight(it);
      if (y - h < FOOTER_LIMIT) {
        newPage();
        drawDayHeader(day, true);
        drawTableHeader(true);
      }
      drawRow(it, i);
    });

    y -= 16; // ruimte tussen dagen
  }

  // ---- Afsluiting: notities-ruimte + handtekeningen ----
  const closeNeed = 150;
  if (y - closeNeed < FOOTER_LIMIT) newPage();
  y -= 6;
  text("Notities", MARGIN, y, 11, bold, accent);
  y -= 16;
  for (let i = 0; i < 3; i++) {
    hline(y, mix(HAIR, WHITE, 0.2), 0.6);
    y -= 18;
  }
  y -= 14;

  // Handtekeningen (twee kolommen).
  const sigW = (CONTENT_W - 30) / 2;
  const sigY = y;
  const sigBlocks = [
    { label: "Handtekening trainer", name: data.trainerName ?? null },
    { label: "Handtekening sporter", name: data.memberName },
  ];
  sigBlocks.forEach((b, i) => {
    const x = MARGIN + i * (sigW + 30);
    hline(sigY, INK, 0.8, x, x + sigW);
    text(b.label, x, sigY - 12, 8.5, font, SUBTLE);
    if (b.name) textRight(`Datum: ____________`, x + sigW, sigY - 12, 8.5, font, SUBTLE);
  });

  // ---- QR-code naar de online versie (pagina 1, rechtsonder boven de footer) ----
  if (data.onlineUrl) {
    try {
      const dataUrl = await QRCode.toDataURL(data.onlineUrl, { margin: 0, width: 160 });
      const png = await doc.embedPng(Buffer.from(dataUrl.split(",")[1], "base64"));
      const first = doc.getPage(0);
      const size = 60;
      const qx = PAGE_W - MARGIN - size;
      const qy = FOOTER_LIMIT + 6;
      first.drawRectangle({
        x: qx - 6,
        y: qy - 6,
        width: size + 12,
        height: size + 22,
        color: col(WHITE),
        borderColor: col(HAIR),
        borderWidth: 0.8,
      });
      first.drawImage(png, { x: qx, y: qy, width: size, height: size });
      first.drawText("Online versie", {
        x: qx,
        y: qy + size + 4,
        size: 7,
        font,
        color: col(SUBTLE),
      });
    } catch {
      // QR overslaan bij fout
    }
  }

  // ---- Footer op elke pagina (page X van Y kan pas nu) ----
  const pages = doc.getPages();
  const total = pages.length;
  const contactBits = [data.website, data.contactPhone, data.contactEmail]
    .filter((v): v is string => Boolean(v && v.trim()))
    .map((v) => sanitize(v));

  pages.forEach((p, i) => {
    p.drawLine({
      start: { x: MARGIN, y: FOOTER_LIMIT - 8 },
      end: { x: PAGE_W - MARGIN, y: FOOTER_LIMIT - 8 },
      thickness: 0.6,
      color: col(HAIR),
    });
    // Regel 1: sportschool · website · contact  —  paginanummer.
    const left1 = [sanitize(data.tenantName), ...contactBits].join("   ·   ");
    p.drawText(left1, { x: MARGIN, y: FOOTER_LIMIT - 20, size: 7.5, font: bold, color: col(SUBTLE) });
    const pageStr = `Pagina ${i + 1} van ${total}`;
    p.drawText(pageStr, {
      x: PAGE_W - MARGIN - bold.widthOfTextAtSize(pageStr, 7.5),
      y: FOOTER_LIMIT - 20,
      size: 7.5,
      font: bold,
      color: col(SUBTLE),
    });
    // Regel 2: veiligheidsmelding  —  aanmaakdatum.
    const safety = "Bij twijfel: raadpleeg altijd een professional / trainer.";
    p.drawText(safety, { x: MARGIN, y: FOOTER_LIMIT - 31, size: 7, font: italic, color: col(mix(SUBTLE, WHITE, 0.15)) });
    const made = `Aangemaakt op ${createdStr}`;
    p.drawText(made, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(made, 7),
      y: FOOTER_LIMIT - 31,
      size: 7,
      font,
      color: col(mix(SUBTLE, WHITE, 0.15)),
    });
  });

  return doc.save();
}
