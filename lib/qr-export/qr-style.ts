// Pure, gedeelde QR-styling: van een module-matrix naar mooie vector-geometrie.
// Géén server-only / geen library-import → bruikbaar op server (SVG/PNG/PDF) én
// client (live preview). Idioom: lib/exercise-types.ts (pure kern, ook client).
//
// Stijl: afgeronde modules in de tenant-accentkleur, afgeronde finder-"ogen"
// (i.p.v. blokjes) en een witte badge in het midden voor het tenant-logo.

import type { QrModules } from "./qr-matrix";

export type QrStyleOptions = {
  /** Accentkleur (hex) voor de modules. Fallback + contrast-guard binnenin. */
  accent?: string | null;
  /** Logo als data-URI (self-contained → werkt in bestand én resvg). */
  logoDataUri?: string | null;
  /** Reserveer een midden-badge zónder data-URI (PDF embedt het logo zelf). */
  reserveLogo?: boolean;
  /** Doelbreedte in px voor de SVG (width/height-attributen). */
  pixelSize?: number;
  /** Quiet zone in modules (aanbevolen ≥4; 3 volstaat met witrand). */
  quiet?: number;
  /** Hoekstraal per module, als fractie van een module (0..0.5). */
  radius?: number;
};

/** Geometrie van één QR, in een unit-grid (1 module = 1 eenheid), y omlaag. */
export type QrGeometry = {
  /** Totale zijde in eenheden (modules + 2× quiet). */
  total: number;
  /** Pad met álle accent-vlakken (body-modules + finder-buitenring + midden). */
  accentPath: string;
  /** Pad met de witte "gaten" (de lichte ring binnen de finder-ogen). */
  holePath: string;
  /** Logo-badge (midden), in dezelfde unit-grid — of null. */
  logoRect: { x: number; y: number; size: number } | null;
};

const DARK_FALLBACK = "#1f2430";
const FINDER = 7; // finder-patroon is 7×7 modules

// --- Kleur-helpers ----------------------------------------------------------
function relLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const srgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

/**
 * Kiest een scanbare modulekleur: geldig hex, en donker genoeg voor contrast op
 * wit. Te lichte accenten (bv. geel) vallen terug op donkergrijs.
 */
export function resolveQrColor(accent: string | null | undefined): string {
  if (!accent) return DARK_FALLBACK;
  const trimmed = accent.trim();
  if (!/^#?([0-9a-f]{6})$/i.test(trimmed)) return DARK_FALLBACK;
  const hex = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  // WCAG-contrast op wit ≈ 1 / (L + 0.05). Eis ≥ ~3:1 → L ≤ ~0.28.
  return relLuminance(hex) > 0.28 ? DARK_FALLBACK : hex;
}

// --- Pad-bouwstenen (bezier-hoeken → werkt in SVG én pdf-lib) ---------------
const K = 0.5522847498; // quarter-arc bezier control-factor

/** Afgeronde rechthoek als één subpad (y omlaag), met bezier-hoeken. */
export function roundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (rr <= 0) {
    return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
  }
  const k = rr * K;
  const x2 = x + w;
  const y2 = y + h;
  return [
    `M${x + rr} ${y}`,
    `L${x2 - rr} ${y}`,
    `C${x2 - rr + k} ${y} ${x2} ${y + rr - k} ${x2} ${y + rr}`,
    `L${x2} ${y2 - rr}`,
    `C${x2} ${y2 - rr + k} ${x2 - rr + k} ${y2} ${x2 - rr} ${y2}`,
    `L${x + rr} ${y2}`,
    `C${x + rr - k} ${y2} ${x} ${y2 - rr + k} ${x} ${y2 - rr}`,
    `L${x} ${y + rr}`,
    `C${x} ${y + rr - k} ${x + rr - k} ${y} ${x + rr} ${y}`,
    "Z",
  ].join("");
}

// Zit (row,col) binnen één van de drie 7×7 finder-patronen?
function inFinder(row: number, col: number, size: number): boolean {
  const inTL = row < FINDER && col < FINDER;
  const inTR = row < FINDER && col >= size - FINDER;
  const inBL = row >= size - FINDER && col < FINDER;
  return inTL || inTR || inBL;
}

/**
 * Bouwt de vector-geometrie voor de gestylde QR. Eén accent-pad (body + finder-
 * buitenring + finder-midden) plus een wit-pad voor de finder-"gaten". Zo blijft
 * het bij twee fills (accent + wit) in zowel SVG als PDF.
 */
export function qrGeometry(matrix: QrModules, opts: QrStyleOptions = {}): QrGeometry {
  const { size, dark } = matrix;
  const quiet = opts.quiet ?? 3;
  const radius = opts.radius ?? 0.42;
  const total = size + quiet * 2;

  const accent: string[] = [];
  const holes: string[] = [];

  // Body-modules (buiten de finder-patronen) als afgeronde vierkantjes.
  const inset = 0.08; // klein gaatje tussen modules voor de "dot"-look
  const cell = 1 - inset * 2;
  const r = radius * cell;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!dark[row * size + col]) continue;
      if (inFinder(row, col, size)) continue;
      const x = quiet + col + inset;
      const y = quiet + row + inset;
      accent.push(roundedRectPath(x, y, cell, cell, r));
    }
  }

  // Finder-ogen: afgeronde buitenring (7×7) + wit gat (5×5) + afgerond midden (3×3).
  const finderOrigins: Array<[number, number]> = [
    [quiet, quiet],
    [quiet + size - FINDER, quiet],
    [quiet, quiet + size - FINDER],
  ];
  for (const [ox, oy] of finderOrigins) {
    accent.push(roundedRectPath(ox, oy, 7, 7, 2.0)); // buitenrand
    holes.push(roundedRectPath(ox + 1, oy + 1, 5, 5, 1.4)); // lichte ring
    accent.push(roundedRectPath(ox + 2, oy + 2, 3, 3, 1.0)); // pupil
  }

  // Logo-badge in het midden (data-URI voor SVG, of gereserveerd voor de PDF).
  let logoRect: QrGeometry["logoRect"] = null;
  if (opts.logoDataUri || opts.reserveLogo) {
    const badge = Math.round(size * 0.26); // ~26% → veilig onder EC-H
    const start = quiet + Math.floor((size - badge) / 2);
    logoRect = { x: start, y: start, size: badge };
  }

  return { total, accentPath: accent.join(""), holePath: holes.join(""), logoRect };
}

/**
 * Volledige, self-contained gestylde SVG-string. Wit gedragvlak + quiet zone,
 * accent-modules, afgeronde ogen en (optioneel) een wit logo-badge met het
 * tenant-logo. Deze SVG voedt zowel de bestandsexport als de resvg-PNG.
 */
export function renderStyledQrSvg(matrix: QrModules, opts: QrStyleOptions = {}): string {
  const geo = qrGeometry(matrix, opts);
  const color = resolveQrColor(opts.accent);
  const px = opts.pixelSize ?? 640;
  const t = geo.total;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" ` +
      `viewBox="0 0 ${t} ${t}" shape-rendering="geometricPrecision">`,
  );
  // Witte drager (incl. quiet zone), lichtjes afgerond.
  parts.push(`<rect x="0" y="0" width="${t}" height="${t}" rx="${Math.min(3, t * 0.06)}" fill="#ffffff"/>`);
  parts.push(`<path d="${geo.accentPath}" fill="${color}"/>`);
  if (geo.holePath) parts.push(`<path d="${geo.holePath}" fill="#ffffff"/>`);

  if (geo.logoRect && opts.logoDataUri) {
    const { x, y, size } = geo.logoRect;
    const pad = size * 0.14; // witruimte tussen badge-rand en logo
    const br = size * 0.22; // badge-hoekstraal
    parts.push(
      `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${br}" fill="#ffffff"/>`,
    );
    parts.push(
      `<image href="${opts.logoDataUri}" x="${x + pad}" y="${y + pad}" ` +
        `width="${size - pad * 2}" height="${size - pad * 2}" ` +
        `preserveAspectRatio="xMidYMid meet"/>`,
    );
  }

  parts.push("</svg>");
  return parts.join("");
}
