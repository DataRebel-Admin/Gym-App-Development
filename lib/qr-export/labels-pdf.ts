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
import { qrMatrix, type QrModules } from "./qr";
import { qrGeometry, roundedRectPath, resolveQrColor } from "./qr-style";
import { LAYOUT_PRESETS, type QrExportGroup, type QrExportMachine, type QrExportOptions } from "./types";

// Printbare A4-rasters van QR-labels. Vector-QR (crisp op elk formaat), tenant-
// branding, nette marges + ruime witruimte, optionele snijlijnen. Model naar
// lib/schema-pdf.ts (pure pdf-lib, geen next-intl-koppeling).

// --- Geometrie -------------------------------------------------------------
const A4: [number, number] = [595.28, 841.89];
const PAGE_W = A4[0];
const PAGE_H = A4[1];
const MARGIN = 34;
const HEADER_H = 48; // gereserveerd bovenaan (branded koptekst)
const FOOTER_H = 26; // gereserveerd onderaan (paginanummer)
const CONTENT_W = PAGE_W - MARGIN * 2;

// --- Kleur-helpers (zoals schema-pdf) --------------------------------------
type Tuple = [number, number, number];
const INK: Tuple = [0.12, 0.14, 0.17];
const SUBTLE: Tuple = [0.45, 0.48, 0.53];
const HAIR: Tuple = [0.82, 0.84, 0.87];
const WHITE: Tuple = [1, 1, 1];

const col = (t: Tuple): RGB => rgb(t[0], t[1], t[2]);

function hexToTuple(hex: string | null | undefined, fallback: Tuple): Tuple {
  if (!hex) return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// Helvetica (WinAnsi) kan enkele typografische tekens niet coderen → normaliseren.
const sanitize = (s: string) =>
  s
    .replace(/[–—]/g, "-")
    .replace(/[•·]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim();

function wrap(text: string, font: PDFFont, size: number, maxW: number, maxLines: number): string[] {
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
  if (lines.length <= maxLines) return lines;
  // Te veel regels → houd de eerste `maxLines`, kap de laatste af met ellipsis.
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && font.widthOfTextAtSize(`${last}...`, size) > maxW) {
    last = last.slice(0, -1);
  }
  kept[maxLines - 1] = `${last.trim()}...`;
  return kept;
}

function ellipsize(text: string, font: PDFFont, size: number, maxW: number): string {
  const t = sanitize(text);
  if (font.widthOfTextAtSize(t, size) <= maxW) return t;
  let s = t;
  while (s.length > 1 && font.widthOfTextAtSize(`${s}...`, size) > maxW) s = s.slice(0, -1);
  return `${s.trim()}...`;
}

// --- QR vector-tekenaar (gestyled) -----------------------------------------
/**
 * Tekent de gestylde QR (afgeronde modules in de accentkleur, afgeronde ogen,
 * optioneel tenant-logo in het midden) als échte vector in een `side`×`side`-vak
 * (linksonder-hoek `x,y`). Deelt de geometrie met de SVG/PNG-export via qrGeometry.
 */
function drawQr(
  page: PDFPage,
  qr: QrModules,
  x: number,
  y: number,
  side: number,
  accentHex: string | null,
  logo: PDFImage | null,
) {
  const geo = qrGeometry(qr, { quiet: 3, reserveLogo: Boolean(logo) });
  const scale = side / geo.total;
  const anchorY = y + side; // pad-y loopt omlaag vanaf de bovenkant
  const qrColor = hexToTuple(resolveQrColor(accentHex), INK);

  // Witte drager (incl. quiet zone).
  page.drawRectangle({ x, y, width: side, height: side, color: col(WHITE) });
  // Accent-modules + finder-ogen, dan de witte "gaten" in de ogen.
  page.drawSvgPath(geo.accentPath, { x, y: anchorY, scale, color: col(qrColor) });
  if (geo.holePath) {
    page.drawSvgPath(geo.holePath, { x, y: anchorY, scale, color: col(WHITE) });
  }

  // Midden-logo met witte badge.
  if (logo && geo.logoRect) {
    const { x: rx, y: ry, size: rs } = geo.logoRect;
    const badgeRadius = rs * 0.22;
    page.drawSvgPath(roundedRectPath(rx, ry, rs, rs, badgeRadius), {
      x,
      y: anchorY,
      scale,
      color: col(WHITE),
    });
    const pad = rs * 0.14;
    const boxSize = (rs - pad * 2) * scale;
    const boxLeft = x + (rx + pad) * scale;
    const boxTop = anchorY - (ry + pad) * scale;
    const ratio = Math.min(boxSize / logo.width, boxSize / logo.height);
    const lw = logo.width * ratio;
    const lh = logo.height * ratio;
    page.drawImage(logo, {
      x: boxLeft + (boxSize - lw) / 2,
      y: boxTop - boxSize + (boxSize - lh) / 2,
      width: lw,
      height: lh,
    });
  }
}

// --- Logo embedden (per URL 1×) --------------------------------------------
async function embedLogo(doc: PDFDocument, url: string | null): Promise<PDFImage | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return url.toLowerCase().endsWith(".png")
      ? await doc.embedPng(bytes)
      : await doc.embedJpg(bytes);
  } catch {
    return null;
  }
}

// =========================================================================
export async function buildQrLabelsPdf(
  groups: QrExportGroup[],
  options: QrExportOptions,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setProducer("GymRebel");
  doc.setTitle("QR-codes apparaten");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const preset = LAYOUT_PRESETS[options.columns];
  const { columns, rows, perPage } = preset;

  const contentTop = PAGE_H - MARGIN - HEADER_H;
  const contentBottom = MARGIN + FOOTER_H;
  const contentH = contentTop - contentBottom;
  const cellW = CONTENT_W / columns;
  const cellH = contentH / rows;

  // Pre-embed logos per groep (unieke url).
  const logoCache = new Map<string, PDFImage | null>();
  for (const g of groups) {
    const key = g.branding.logoUrl ?? "";
    if (options.includeLogo && key && !logoCache.has(key)) {
      logoCache.set(key, await embedLogo(doc, g.branding.logoUrl));
    }
  }

  let page!: PDFPage;

  function drawHeader(g: QrExportGroup, accent: Tuple, logo: PDFImage | null) {
    // Full-bleed accentband bovenaan.
    page.drawRectangle({ x: 0, y: PAGE_H - 6, width: PAGE_W, height: 6, color: col(accent) });
    let tx = MARGIN;
    const baseY = PAGE_H - MARGIN - 6;
    if (logo) {
      const h = 22;
      const scaled = logo.scale(h / logo.height);
      const w = Math.min(scaled.width, 90);
      page.drawImage(logo, { x: MARGIN, y: baseY - h + 4, width: w, height: (w / scaled.width) * scaled.height });
      tx = MARGIN + w + 12;
    }
    page.drawText(sanitize(g.branding.tenantName), { x: tx, y: baseY - 8, size: 14, font: bold, color: col(accent) });
    const sub = "QR-codes apparaten";
    page.drawText(sub, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(sub, 9),
      y: baseY - 7,
      size: 9,
      font,
      color: col(SUBTLE),
    });
    page.drawLine({
      start: { x: MARGIN, y: contentTop + 12 },
      end: { x: PAGE_W - MARGIN, y: contentTop + 12 },
      thickness: 0.8,
      color: col(HAIR),
    });
  }

  // Eén label-cel tekenen.
  function drawCell(
    cxLeft: number,
    cyTop: number,
    m: QrExportMachine,
    qr: QrModules,
    accent: Tuple,
    logo: PDFImage | null,
    branding: QrExportGroup["branding"],
  ) {
    // Snijlijnen: gestippelde cel-rand.
    if (options.cutMarks) {
      page.drawRectangle({
        x: cxLeft,
        y: cyTop - cellH,
        width: cellW,
        height: cellH,
        borderColor: col(HAIR),
        borderWidth: 0.6,
        borderDashArray: [3, 3],
      });
    }

    const pad = columns === 2 ? 16 : 11;
    const innerX = cxLeft + pad;
    const innerTop = cyTop - pad;
    const innerW = cellW - pad * 2;
    const innerH = cellH - pad * 2;

    // QR links, verticaal gecentreerd.
    const qrSide = Math.min(innerH, innerW * (columns === 2 ? 0.44 : 0.5));
    const qrX = innerX;
    const qrY = innerTop - (innerH + qrSide) / 2 + innerH / 2; // gecentreerd
    drawQr(page, qr, qrX, qrY, qrSide, branding.accentColor, logo);

    // Tekstblok rechts.
    const tx = qrX + qrSide + (columns === 2 ? 16 : 10);
    const tw = innerX + innerW - tx;
    let ty = innerTop; // bovenkant tekstblok

    const nameSize = columns === 2 ? 13 : 10;
    const metaSize = columns === 2 ? 8.5 : 7.5;

    // Apparaatnaam (max 2 regels).
    const nameLines = wrap(m.name, bold, nameSize, tw, 2);
    ty -= nameSize;
    for (const ln of nameLines) {
      page.drawText(ln, { x: tx, y: ty, size: nameSize, font: bold, color: col(INK) });
      ty -= nameSize + 2;
    }

    // Nummer (+ categorie).
    ty -= 3;
    const numLabel = `Nr. ${m.number}`;
    page.drawText(numLabel, { x: tx, y: ty, size: metaSize, font: bold, color: col(accent) });
    if (options.includeCategory && m.category) {
      const numW = bold.widthOfTextAtSize(numLabel, metaSize);
      const catX = tx + numW + 8;
      page.drawText(ellipsize(m.category, font, metaSize, Math.max(0, innerX + innerW - catX)), {
        x: catX,
        y: ty,
        size: metaSize,
        font,
        color: col(SUBTLE),
      });
    }
    ty -= metaSize + 4;

    // Serienummer.
    if (options.includeSerial && m.serialNumber) {
      page.drawText(ellipsize(`SN: ${m.serialNumber}`, font, metaSize, tw), {
        x: tx,
        y: ty,
        size: metaSize,
        font,
        color: col(SUBTLE),
      });
      ty -= metaSize + 4;
    }

    // Locatie (indien aanwezig — handig bij ophangen).
    if (m.location) {
      page.drawText(ellipsize(m.location, font, metaSize, tw), {
        x: tx,
        y: ty,
        size: metaSize,
        font,
        color: col(SUBTLE),
      });
      ty -= metaSize + 4;
    }

    // Sportschool-branding onderaan de cel (klein logo + naam).
    const brandSize = columns === 2 ? 8 : 7;
    const brandY = innerTop - innerH + 2;
    let bx = tx;
    if (options.includeLogo && logo) {
      const h = brandSize + 3;
      const scaled = logo.scale(h / logo.height);
      const w = Math.min(scaled.width, 28);
      page.drawImage(logo, { x: bx, y: brandY - 1, width: w, height: (w / scaled.width) * scaled.height });
      bx += w + 5;
    }
    page.drawText(ellipsize(branding.tenantName, font, brandSize, innerX + innerW - bx), {
      x: bx,
      y: brandY,
      size: brandSize,
      font,
      color: col(SUBTLE),
    });
  }

  // --- Groepen renderen (elke tenant start op een verse pagina) ---
  for (const g of groups) {
    if (g.machines.length === 0) continue;
    const accent = hexToTuple(g.branding.accentColor, [0.11, 0.13, 0.16]);
    const logo = options.includeLogo ? logoCache.get(g.branding.logoUrl ?? "") ?? null : null;

    g.machines.forEach((machine, i) => {
      const posInPage = i % perPage;
      if (posInPage === 0) {
        page = doc.addPage(A4);
        drawHeader(g, accent, logo);
      }
      const colIdx = posInPage % columns;
      const rowIdx = Math.floor(posInPage / columns);
      const cxLeft = MARGIN + colIdx * cellW;
      const cyTop = contentTop - rowIdx * cellH;
      const qr = qrMatrix(machine.url);
      drawCell(cxLeft, cyTop, machine, qr, accent, logo, g.branding);
    });
  }

  // Leeg? Toch één lege pagina met kop zodat de download nooit stuk is.
  if (doc.getPageCount() === 0) {
    page = doc.addPage(A4);
    const g = groups[0] ?? { branding: { tenantName: "GymRebel", logoUrl: null, accentColor: null }, machines: [] };
    drawHeader(g, hexToTuple(g.branding.accentColor, [0.11, 0.13, 0.16]), null);
    page.drawText("Geen apparaten om te exporteren.", {
      x: MARGIN,
      y: contentTop - 40,
      size: 11,
      font,
      color: col(SUBTLE),
    });
  }

  // --- Voettekst per pagina (paginanummer) ---
  const pages = doc.getPages();
  const total = pages.length;
  pages.forEach((p, i) => {
    p.drawLine({
      start: { x: MARGIN, y: contentBottom - 8 },
      end: { x: PAGE_W - MARGIN, y: contentBottom - 8 },
      thickness: 0.6,
      color: col(HAIR),
    });
    p.drawText("GymRebel", { x: MARGIN, y: contentBottom - 20, size: 7.5, font, color: col(SUBTLE) });
    const pageStr = `Pagina ${i + 1} van ${total}`;
    p.drawText(pageStr, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(pageStr, 7.5),
      y: contentBottom - 20,
      size: 7.5,
      font,
      color: col(SUBTLE),
    });
  });

  return doc.save();
}
