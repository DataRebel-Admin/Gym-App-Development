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
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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
  return svg("0 0 1859 236", lockupBody(gym, accent), "GymRebel");
}

/** Alleen de inhoud van de horizontale lockup, in zijn 1859×236-coordinaten. */
function lockupBody(gym: string, accent: string = BRAND.orange): string {
  const scale = 0.6574;
  return (
    `<g transform="scale(${scale})">${markBody(accent)}</g>` +
    `<g transform="translate(513,44)">${wordmarkBody(gym, accent)}</g>`
  );
}

const LOCKUP_W = 1859;
const LOCKUP_H = 236;

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

/**
 * Play Store **feature graphic** (1024x500) — verplicht onderdeel van de
 * store-listing, en die moet compleet zijn voordat je een gesloten test mag
 * starten.
 *
 * Twee eisen die de vorm bepalen:
 * - **Geen alfakanaal.** Play wil 24-bits PNG of JPEG; daarom `pngOpaque`,
 *   dezelfde route als het iOS-icoon.
 * - **Tekst uit de randen.** Play schaalt en snijdt deze afbeelding in
 *   verschillende plaatsingen, en legt er bij een promovideo een afspeelknop
 *   overheen. Het logo staat daarom gecentreerd op ~62% breedte, ruim binnen
 *   de veilige zone.
 *
 * Bewust alleen het merk, geen slogan: tekst in de afbeelding zou per taal
 * opnieuw gemaakt moeten worden, terwijl de korte omschrijving eronder al
 * vertaalbaar is.
 */
function featureGraphic(): string {
  const W = 1024;
  const H = 500;
  const k = (W * 0.62) / LOCKUP_W;
  const x = (W - LOCKUP_W * k) / 2;
  const y = (H - LOCKUP_H * k) / 2;
  return svg(
    `0 0 ${W} ${H}`,
    `<defs><radialGradient id="glow" cx="50%" cy="46%" r="62%">` +
      `<stop offset="0%" stop-color="${BRAND.orange}" stop-opacity="0.30"/>` +
      `<stop offset="100%" stop-color="${BRAND.orange}" stop-opacity="0"/>` +
      `</radialGradient></defs>` +
      `<rect width="${W}" height="${H}" fill="${BRAND.black}"/>` +
      `<rect width="${W}" height="${H}" fill="url(#glow)"/>` +
      `<g transform="translate(${x.toFixed(2)},${y.toFixed(2)}) scale(${k.toFixed(5)})">` +
      `${lockupBody(BRAND.white)}</g>`,
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
 * Zelfde als {@link png}, maar **zonder alfakanaal**.
 *
 * resvg levert altijd RGBA, ook als elke pixel dekkend is. Voor het iOS-app-icoon
 * is dat fataal: App Store Connect weigert de upload met
 * `ITMS-90717: Invalid App Store Icon … can't be transparent nor contain an
 * alpha channel`. sharp plat het beeld af op de merkkleur (die toch al de
 * achtergrond is, dus visueel verandert er niets) en schrijft RGB zonder alfa.
 */
async function pngOpaque(source: string, width: number): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  return sharp(png(source, width))
    .flatten({ background: BRAND.orange })
    .png({ compressionLevel: 9 })
    .toBuffer();
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

/**
 * Statusbalk-meldingsicoon (Android).
 *
 * Android gebruikt hiervan **uitsluitend het alfakanaal** en kleurt het daarna
 * zelf in met de accentkleur. Een gewoon oranje/zwart icoon wordt daardoor een
 * egale witte blob. Dus: wit silhouet op transparant, met ruime marge zodat het
 * niet tegen de randen van het 24dp-vak plakt.
 */
function notificationIcon(): string {
  const size = 1024;
  const k = (size * 0.74) / MARK_W;
  return svg(
    `0 0 ${size} ${size}`,
    `<g transform="translate(${(size - MARK_W * k) / 2},${(size - MARK_H * k) / 2}) scale(${k})">${markBody(BRAND.white)}</g>`,
    "GymRebel"
  );
}

/**
 * Splashscherm: gestapelde lockup, gecentreerd op Brand Book Black. Gedeeld door
 * Android (dichtheid-drawables) en iOS (één vierkant beeld dat aspect-fill wordt
 * bijgesneden), zodat beide platforms exact hetzelfde startscherm tonen.
 */
function splashArt(w: number, h: number): string {
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

  const statusIcon = notificationIcon();

  // dichtheid → [launcher-formaat, voorgrond-formaat (108dp-canvas), meldingsicoon (24dp)]
  const densities: [string, number, number, number][] = [
    ["mdpi", 48, 108, 24],
    ["hdpi", 72, 162, 36],
    ["xhdpi", 96, 216, 48],
    ["xxhdpi", 144, 324, 72],
    ["xxxhdpi", 192, 432, 96],
  ];
  for (const [density, icon, fg, stat] of densities) {
    write(`${ANDROID_RES}/mipmap-${density}/ic_launcher.png`, png(launcher, icon));
    write(`${ANDROID_RES}/mipmap-${density}/ic_launcher_round.png`, png(round, icon));
    write(`${ANDROID_RES}/mipmap-${density}/ic_launcher_foreground.png`, png(foreground, fg));
    // In `drawable-*`, niet `mipmap-*`: FCM zoekt het meldingsicoon op als drawable.
    write(`${ANDROID_RES}/drawable-${density}/ic_stat_gymrebel.png`, png(statusIcon, stat));
  }

  // Het adaptive-icon (mipmap-anydpi-v26) tekent de achtergrond uit deze
  // kleurresource; die stond nog op Capacitors wit.
  // `splashScreenBackground` wordt gebruikt door res/values-v31/styles.xml (het
  // startscherm op Android 12+, waar het systeem de drawable negeert).
  write(
    `${ANDROID_RES}/values/ic_launcher_background.xml`,
    `<?xml version="1.0" encoding="utf-8"?>\n` +
      `<resources>\n` +
      `    <color name="ic_launcher_background">${BRAND.orange}</color>\n` +
      `    <color name="splashScreenBackground">${BRAND.black}</color>\n` +
      `</resources>\n`
  );

  // Capacitor's eigen placeholder-vectors (de groene Android-robot op een
  // blauw patroon) blijven anders als dode resources in de APK staan. Ze zijn
  // nergens meer aan gekoppeld: `ic_launcher.xml` wijst naar `@color/…` en
  // `@mipmap/…`, niet naar deze `@drawable/…`. Opruimen hier, zodat het ook ná
  // een verse `npx cap add android` weer klopt.
  for (const dead of ["drawable/ic_launcher_background.xml", "drawable-v24/ic_launcher_foreground.xml"]) {
    const path = join(ROOT, ANDROID_RES, dead);
    if (existsSync(path)) {
      rmSync(path);
      console.log(`- ${ANDROID_RES}/${dead} (Capacitor-placeholder verwijderd)`);
    }
  }

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
    write(`${ANDROID_RES}/${dir}/splash.png`, png(splashArt(w, h), w));
  }
} else {
  console.log("• android/ niet aanwezig — native iconen overgeslagen.");
}

// ── iOS (Capacitor) ──────────────────────────────────────────────────────────
// `ios/` bestaat alleen op een Mac (of macOS-CI-runner), want `npx cap add ios`
// vereist Xcode en CocoaPods. Dezelfde guard als hierboven: draait dit script op
// Windows, dan wordt dit blok stil overgeslagen.
const IOS_ASSETS = "ios/App/App/Assets.xcassets";

/**
 * Async omdat het afplatten van het alfakanaal via sharp loopt. Een top-level
 * `await` kan niet: tsx compileert dit script naar CJS.
 */
async function writeIosAssets(): Promise<void> {
  if (!existsSync(join(ROOT, IOS_ASSETS))) {
    console.log("• ios/ niet aanwezig — iOS-assets overgeslagen (vereist macOS + `npx cap add ios`).");
    return;
  }

  // App-icoon: **full-bleed, géén afgeronde hoeken en géén transparantie**. iOS
  // legt zelf het masker en de hoekradius op; een icoon dat de ronding al
  // ingebakken heeft, krijgt zichtbare donkere hoeken. Een alfakanaal is zelfs
  // reden voor afkeuring bij het uploaden naar App Store Connect.
  write(
    `${IOS_ASSETS}/AppIcon.appiconset/AppIcon-512@2x.png`,
    await pngOpaque(appIcon({ rounded: false, scale: 1 }), 1024)
  );
  write(
    `${IOS_ASSETS}/AppIcon.appiconset/Contents.json`,
    JSON.stringify(
      {
        images: [{ filename: "AppIcon-512@2x.png", idiom: "universal", platform: "ios", size: "1024x1024" }],
        info: { author: "gymrebel", version: 1 },
      },
      null,
      2
    ) + "\n"
  );

  // Splash: één vierkant beeld van 2732×2732 (de grootte van de grootste iPad),
  // dat op elk toestel aspect-fill wordt bijgesneden. Vierkant omdat hetzelfde
  // bestand zowel portret als landschap moet dekken. Het logo staat gecentreerd
  // en beslaat ruim binnen de veilige zone, dus bijsnijden raakt het nooit.
  const iosSplash = png(splashArt(2732, 2732), 2732);
  for (const name of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
    write(`${IOS_ASSETS}/Splash.imageset/${name}`, iosSplash);
  }
  write(
    `${IOS_ASSETS}/Splash.imageset/Contents.json`,
    JSON.stringify(
      {
        images: [
          { filename: "splash-2732x2732.png", idiom: "universal", scale: "1x" },
          { filename: "splash-2732x2732-1.png", idiom: "universal", scale: "2x" },
          { filename: "splash-2732x2732-2.png", idiom: "universal", scale: "3x" },
        ],
        info: { author: "gymrebel", version: 1 },
      },
      null,
      2
    ) + "\n"
  );
}

/** Store-assets die geen alfakanaal mogen hebben (Play feature graphic). */
async function writeStoreAssets(): Promise<void> {
  write("store/assets/play-feature-graphic.png", await pngOpaque(featureGraphic(), 1024));
}

writeIosAssets()
  .then(writeStoreAssets)
  .then(() => console.log("Klaar — merk-assets gegenereerd."))
  .catch((err) => {
    console.error("✗ assets genereren mislukt:", err);
    process.exit(1);
  });
