// scripts/generate-brand-assets.ts
//
// Genereert álle statische merk-bestanden uit één vector-bron
// (`components/brand/logo-art.ts`) — de SVG's in `public/brand/`, de PWA-iconen
// in `public/icons/`, `public/favicon.svg` en `app/favicon.ico`.
//
// - **Eén bron van waarheid**: dezelfde paden die de React-componenten inline
//   renderen. Een bestand in `public/` kan dus nooit uit de pas lopen met de UI.
// - Geen extra dependency: rasteriseren gaat via `@resvg/resvg-js` (al aanwezig
//   voor de QR-export). Idempotent — overschrijft bij elke run.
// - Kleuren komen uit `BRAND` (Brand Book): Rebel Orange, Charcoal, Black, White.
//
// Gebruik: npm run brand:assets
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import {
  BRAND,
  MARK_BARS,
  MARK_MONOGRAM,
  MARK_MONOGRAM_X,
  WORDMARK_GYM,
  WORDMARK_REBEL,
} from "../components/brand/logo-art";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const MARK_W = 674;
const MARK_H = 359;
const WORD_W = 1346;
const WORD_H = 148;

/** Het beeldmerk als SVG-fragment in zijn eigen 674×359-coördinaten. */
function markBody(fill: string): string {
  const bars = MARK_BARS.map(
    (b) =>
      `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.r}" ry="${b.r}"/>`
  ).join("");
  return `<g fill="${fill}">${bars}<g transform="translate(${MARK_MONOGRAM_X},0)"><path fill-rule="evenodd" d="${MARK_MONOGRAM}"/></g></g>`;
}

/** Het woordmerk als SVG-fragment; "GYM" krijgt de neutrale kleur. */
function wordmarkBody(gym: string, rebel: string): string {
  return `<path fill="${gym}" fill-rule="evenodd" d="${WORDMARK_GYM}"/><path fill="${rebel}" fill-rule="evenodd" d="${WORDMARK_REBEL}"/>`;
}

function svg(viewBox: string, body: string, label: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${label}"><title>${label}</title>${body}</svg>\n`;
}

/** Horizontale lockup: beeldmerk links, woordmerk rechts (zelfde maatvoering
 *  als `GymRebelLogo` in components/brand/gymrebel-logo.tsx). `accent` = de
 *  kleur van beeldmerk + "REBEL"; gelijk aan `gym` levert de mono-variant. */
function lockup(gym: string, accent: string = BRAND.orange): string {
  const scale = 0.6574;
  return svg(
    "0 0 1859 236",
    `<g transform="scale(${scale})">${markBody(accent)}</g>` +
      `<g transform="translate(513,44)">${wordmarkBody(gym, accent)}</g>`,
    "GymRebel"
  );
}

/** Maatvoering van de gestapelde lockup (beeldmerk boven, woordmerk onder). */
const STACK = (() => {
  const wordScale = 0.62; // woordmerk iets smaller dan de mark-breedte
  const wordW = WORD_W * wordScale;
  const gap = 46;
  return {
    wordScale,
    wordW,
    gap,
    w: Math.max(MARK_W, wordW),
    h: MARK_H + gap + WORD_H * wordScale,
  };
})();

/** Gestapelde lockup — voor splashschermen en verticale plaatsingen. */
function stacked(gym: string): string {
  return svg(
    `0 0 ${Math.round(STACK.w)} ${Math.round(STACK.h)}`,
    stackedBody(gym),
    "GymRebel"
  );
}

/** Alleen de inhoud van de gestapelde lockup (zonder <svg>-wikkel). */
function stackedBody(gym: string): string {
  return (
    `<g transform="translate(${(STACK.w - MARK_W) / 2},0)">${markBody(BRAND.orange)}</g>` +
    `<g transform="translate(${(STACK.w - STACK.wordW) / 2},${MARK_H + STACK.gap}) scale(${STACK.wordScale})">${wordmarkBody(gym, BRAND.orange)}</g>`
  );
}

/** App-icoon: zwart beeldmerk op Rebel Orange (Brand Book, "APP ICON"). */
function appIcon({ rounded, scale }: { rounded: boolean; scale: number }): string {
  const size = 1024;
  const bg = rounded
    ? `<rect width="${size}" height="${size}" rx="228" fill="${BRAND.orange}"/>`
    : `<rect width="${size}" height="${size}" fill="${BRAND.orange}"/>`;
  const k = ((size * 0.86) / MARK_W) * scale;
  const x = (size - MARK_W * k) / 2;
  const y = (size - MARK_H * k) / 2;
  return svg(
    `0 0 ${size} ${size}`,
    `${bg}<g transform="translate(${x.toFixed(2)},${y.toFixed(2)}) scale(${k.toFixed(5)})">${markBody(BRAND.black)}</g>`,
    "GymRebel"
  );
}

/** Favicon: het beeldmerk in Rebel Orange op transparant, vierkant uitgelijnd. */
function faviconSvg(): string {
  const size = 1024;
  const k = (size * 0.88) / MARK_W;
  const x = (size - MARK_W * k) / 2;
  const y = (size - MARK_H * k) / 2;
  return svg(
    `0 0 ${size} ${size}`,
    `<g transform="translate(${x.toFixed(2)},${y.toFixed(2)}) scale(${k.toFixed(5)})">${markBody(BRAND.orange)}</g>`,
    "GymRebel"
  );
}

function png(source: string, width: number): Buffer {
  return new Resvg(source, { fitTo: { mode: "width", value: width } }).render().asPng();
}

/**
 * Bouwt een .ico met PNG-payloads (Vista+ formaat, door elke moderne browser
 * ondersteund). Geen extra dependency nodig: de container is 6 bytes header +
 * 16 bytes per afbeelding.
 */
function ico(images: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries: Buffer[] = [];
  for (const img of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(img.size >= 256 ? 0 : img.size, 0);
    e.writeUInt8(img.size >= 256 ? 0 : img.size, 1);
    e.writeUInt8(0, 2); // palet
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(img.data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += img.data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

function write(relativePath: string, data: string | Buffer) {
  const target = join(ROOT, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
  const size = typeof data === "string" ? Buffer.byteLength(data) : data.length;
  console.log(`✓ ${relativePath} (${(size / 1024).toFixed(1)} kB)`);
}

// ── SVG's ────────────────────────────────────────────────────────────────────
// `-dark` = bedoeld vóór een donkere ondergrond (wit "GYM"), zonder achtervoegsel
// = voor een lichte ondergrond (charcoal "GYM").
write("public/brand/gymrebel-mark.svg", svg(`0 0 ${MARK_W} ${MARK_H}`, markBody(BRAND.orange), "GymRebel"));
write("public/brand/gymrebel-logo.svg", lockup(BRAND.charcoal));
write("public/brand/gymrebel-logo-dark.svg", lockup(BRAND.white));
write("public/brand/gymrebel-stacked.svg", stacked(BRAND.charcoal));
write("public/brand/gymrebel-stacked-dark.svg", stacked(BRAND.white));
write("public/brand/gymrebel-logo-mono.svg", lockup(BRAND.white, BRAND.white));
write("public/brand/gymrebel-app-icon.svg", appIcon({ rounded: true, scale: 1 }));
write("public/favicon.svg", faviconSvg());

// E-maillogo: **PNG, geen SVG** — Gmail en Outlook weigeren SVG in <img>. Wit op
// transparant, want de mailheader is altijd een accentbalk (zie lib/email/layout.ts).
// 480 px breed = 3× de weergavebreedte van 160 px, dus scherp op retina.
write("public/brand/gymrebel-logo-email.png", png(lockup(BRAND.white, BRAND.white), 480));

// ── Raster ───────────────────────────────────────────────────────────────────
// Afgerond vlak voor de "any"/apple-iconen; full-bleed + kleinere mark (veilige
// zone van 80%) voor de Android-maskable-variant.
const roundedIcon = appIcon({ rounded: true, scale: 1 });
const maskableIcon = appIcon({ rounded: false, scale: 0.78 });
write("public/icons/icon-192.png", png(roundedIcon, 192));
write("public/icons/icon-512.png", png(roundedIcon, 512));
write("public/icons/icon-maskable-512.png", png(maskableIcon, 512));
write("public/icons/apple-icon-180.png", png(appIcon({ rounded: false, scale: 1 }), 180));

// Favicon: transparant beeldmerk (past op licht én donker browser-chrome).
const fav = faviconSvg();
write(
  "app/favicon.ico",
  ico([16, 32, 48].map((size) => ({ size, data: png(fav, size) })))
);

// ── Android (Capacitor) ──────────────────────────────────────────────────────
// De native schil krijgt dezelfde bron. Capacitor genereert `android/` met zijn
// eigen placeholder-iconen (groene robot, wit vlak); die overschrijven we hier.
// Draai dit script opnieuw na een `npx cap add android`.
const ANDROID_RES = "android/app/src/main/res";

/** Rond launcher-icoon: beeldmerk in een oranje cirkel. */
function androidRoundIcon(): string {
  const size = 1024;
  const k = (size * 0.62) / MARK_W;
  return svg(
    `0 0 ${size} ${size}`,
    `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${BRAND.orange}"/>` +
      `<g transform="translate(${(size - MARK_W * k) / 2},${(size - MARK_H * k) / 2}) scale(${k})">${markBody(BRAND.black)}</g>`,
    "GymRebel"
  );
}

/**
 * Adaptive-icon voorgrond: alléén het beeldmerk op transparant, binnen de
 * veilige zone. Android maskeert een 108dp-canvas tot een cirkel van ~66dp, dus
 * de brede halter mag maximaal ~58% van het canvas beslaan — anders snijdt een
 * rond systeemmasker de gewichtschijven eraf.
 */
function androidForeground(): string {
  const size = 1024;
  const k = (size * 0.58) / MARK_W;
  return svg(
    `0 0 ${size} ${size}`,
    `<g transform="translate(${(size - MARK_W * k) / 2},${(size - MARK_H * k) / 2}) scale(${k})">${markBody(BRAND.black)}</g>`,
    "GymRebel"
  );
}

/** Splashscherm: gestapelde lockup, gecentreerd op Brand Book Black. */
function androidSplash(w: number, h: number): string {
  const logoW = Math.min(w * 0.52, ((h * 0.42) / STACK.h) * STACK.w);
  const k = logoW / STACK.w;
  return svg(
    `0 0 ${w} ${h}`,
    `<rect width="${w}" height="${h}" fill="${BRAND.black}"/>` +
      `<g transform="translate(${(w - STACK.w * k) / 2},${(h - STACK.h * k) / 2}) scale(${k})">${stackedBody(BRAND.white)}</g>`,
    "GymRebel"
  );
}

if (existsSync(join(ROOT, ANDROID_RES))) {
  const launcher = appIcon({ rounded: true, scale: 1 });
  const round = androidRoundIcon();
  const foreground = androidForeground();

  // dichtheid → [launcher-formaat, voorgrond-formaat (108dp-canvas)]
  const densities: [string, number, number][] = [
    ["mdpi", 48, 108],
    ["hdpi", 72, 162],
    ["xhdpi", 96, 216],
    ["xxhdpi", 144, 324],
    ["xxxhdpi", 192, 432],
  ];
  for (const [density, icon, fg] of densities) {
    write(`${ANDROID_RES}/mipmap-${density}/ic_launcher.png`, png(launcher, icon));
    write(`${ANDROID_RES}/mipmap-${density}/ic_launcher_round.png`, png(round, icon));
    write(`${ANDROID_RES}/mipmap-${density}/ic_launcher_foreground.png`, png(foreground, fg));
  }

  // Het adaptive-icon (mipmap-anydpi-v26) tekent de achtergrond uit deze
  // kleurresource; die stond nog op Capacitors wit.
  write(
    `${ANDROID_RES}/values/ic_launcher_background.xml`,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BRAND.orange}</color>\n</resources>\n`
  );

  // Splash: exact de formaten die Capacitor aanmaakt (portret/landschap per dichtheid).
  const splashes: [string, number, number][] = [
    ["drawable", 480, 320],
    ["drawable-land-mdpi", 480, 320],
    ["drawable-land-hdpi", 800, 480],
    ["drawable-land-xhdpi", 1280, 720],
    ["drawable-land-xxhdpi", 1600, 960],
    ["drawable-land-xxxhdpi", 1920, 1280],
    ["drawable-port-mdpi", 320, 480],
    ["drawable-port-hdpi", 480, 800],
    ["drawable-port-xhdpi", 720, 1280],
    ["drawable-port-xxhdpi", 960, 1600],
    ["drawable-port-xxxhdpi", 1280, 1920],
  ];
  for (const [dir, w, h] of splashes) {
    write(`${ANDROID_RES}/${dir}/splash.png`, png(androidSplash(w, h), w));
  }
} else {
  console.log("• android/ niet aanwezig — native iconen overgeslagen.");
}

console.log("Klaar — merk-assets gegenereerd.");
