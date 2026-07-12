/**
 * Genereert de PWA/app-iconen uit één vector-bron — geen externe assets, geen
 * extra dependency (draait op @resvg/resvg-js, al aanwezig voor QR-rasterisatie).
 * Idempotent: overschrijft de PNG's bij elke run.
 *
 *   node scripts/generate-app-icons.mjs      (of: npm run icons:generate)
 *
 * Merk-mark = witte halter op accent-oranje. Puur vector (rects), dus
 * font-onafhankelijk en scherp op elk formaat.
 */
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "icons");

// GymRebel default-merk-accent (zelfde als de e-mail-branding-fallback).
const ACCENT = "#e84b1f";

/** Halter-mark, gecentreerd in een 512-canvas. */
function dumbbell() {
  return `
    <g fill="#ffffff">
      <rect x="150" y="240" width="212" height="32" rx="16"/>
      <rect x="160" y="214" width="24" height="84" rx="10"/>
      <rect x="328" y="214" width="24" height="84" rx="10"/>
      <rect x="116" y="190" width="34" height="132" rx="16"/>
      <rect x="362" y="190" width="34" height="132" rx="16"/>
    </g>`;
}

function buildSvg({ rounded, markScale }) {
  const bg = rounded
    ? `<rect width="512" height="512" rx="114" fill="${ACCENT}"/>`
    : `<rect width="512" height="512" fill="${ACCENT}"/>`;
  const mark = `<g transform="translate(256 256) scale(${markScale}) translate(-256 -256)">${dumbbell()}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${bg}${mark}</svg>`;
}

function render(svg, width) {
  return new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
}

// Rounded bg voor de "any"/apple-iconen; full-bleed + kleinere mark (veilige zone)
// voor de Android-maskable-variant.
const targets = [
  { file: "icon-192.png", svg: buildSvg({ rounded: true, markScale: 1 }), size: 192 },
  { file: "icon-512.png", svg: buildSvg({ rounded: true, markScale: 1 }), size: 512 },
  { file: "icon-maskable-512.png", svg: buildSvg({ rounded: false, markScale: 0.78 }), size: 512 },
  { file: "apple-icon-180.png", svg: buildSvg({ rounded: false, markScale: 1 }), size: 180 },
];

mkdirSync(OUT, { recursive: true });
for (const t of targets) {
  writeFileSync(join(OUT, t.file), render(t.svg, t.size));
  console.log(`✓ public/icons/${t.file} (${t.size}px)`);
}
console.log("Klaar — app-iconen gegenereerd.");
