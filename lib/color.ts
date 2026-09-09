// Pure kleur-helpers (géén server-only) — bruikbaar in server- én client-code.
// Bron van waarheid voor contrast/leesbaarheid, zodat de web-UI, e-mails en QR-
// codes exact dezelfde luminantie-logica delen. Voorheen leefde `readableText`
// in lib/email/branding.ts (server-only); hier is 'ie ook client-side te gebruiken
// (bv. de contrastwaarschuwing in de kleurkiezer).

/** Valideer een hex-kleur (#rgb of #rrggbb). */
export function isHexColor(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

/** Normaliseer #rgb → #rrggbb en geef de r/g/b als 0..1 terug (null bij ongeldig). */
function rgb01(hex: string): { r: number; g: number; b: number } | null {
  if (!isHexColor(hex)) return null;
  const h = hex.trim().replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return {
    r: parseInt(full.slice(0, 2), 16) / 255,
    g: parseInt(full.slice(2, 4), 16) / 255,
    b: parseInt(full.slice(4, 6), 16) / 255,
  };
}

const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** Relatieve luminantie (WCAG) van een hex-kleur; 0 (zwart) .. 1 (wit). */
export function luminance(hex: string): number {
  const c = rgb01(hex);
  if (!c) return 0;
  return 0.2126 * linear(c.r) + 0.7152 * linear(c.g) + 0.0722 * linear(c.b);
}

/**
 * Kies wit of donkergrijs als tekstkleur óp deze achtergrond (knoplabel,
 * e-mailheader, `--tenant-accent-foreground`).
 *
 * Wit blijft de voorkeur zolang het comfortabel leesbaar is (≥ 3:1, de
 * WCAG-grens voor grote tekst en UI-componenten). Pas bij een licht accent
 * (geel, limoen, lichtgroen) klapt het om naar donkergrijs — dáár leverde de
 * oude luminantie-grens (0,55) wit-op-geel op, ~1,8:1 en dus onleesbaar.
 * Donkere en middeldonkere accenten (o.a. het GymRebel-oranje) houden wit.
 */
export function readableText(bg: string): string {
  return contrastRatio(bg, "#ffffff") >= 3 ? "#ffffff" : "#111827";
}

/** WCAG-contrastratio tussen twee hex-kleuren (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Is deze accentkleur te licht om als tekst/icoon-kleur op een witte achtergrond
 * te gebruiken? `text-accent` op lichte kaarten wordt dan onleesbaar. Grens 3:1 =
 * de WCAG-drempel voor grote tekst en UI-componenten.
 */
export function accentLowContrastOnLight(accent: string): boolean {
  if (!isHexColor(accent)) return false;
  return contrastRatio(accent, "#ffffff") < 3;
}

/* ------------------------------------------------------------------
 * Contrastgarantie op het tenant-accent
 * ------------------------------------------------------------------ */

/** Het kaartoppervlak per thema (`--surface-1` in globals.css): de ondergrond
 *  waar `text-accent`, accent-randen en -iconen tegen moeten afsteken. */
const ACCENT_SURFACE = { light: "#ffffff", dark: "#111111" } as const;

/** Richting waarin een te vlak accent wordt bijgemengd: op donker naar wit
 *  (oplichten), op licht naar zwart (verdonkeren). */
const ACCENT_LIFT = { light: "#000000", dark: "#ffffff" } as const;

/** WCAG-grens voor grote tekst en UI-componenten — dezelfde 3:1 die
 *  `readableText` hanteert, zodat het hele systeem één drempel deelt. */
export const MIN_ACCENT_CONTRAST = 3;

/** Meng twee hex-kleuren lineair in sRGB — de web-tegenhanger van CSS
 *  `color-mix(in srgb, a X%, b)`, zodat een bijgemengd accent exact zo uitpakt
 *  als de afgeleide tokens die datzelfde color-mix gebruiken. */
function mixHex(a: string, b: string, amountOfB: number): string {
  const ca = rgb01(a);
  const cb = rgb01(b);
  if (!ca || !cb) return a;
  const t = Math.min(1, Math.max(0, amountOfB));
  const ch = (x: number, y: number) =>
    Math.round((x + (y - x) * t) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(ca.r, cb.r)}${ch(ca.g, cb.g)}${ch(ca.b, cb.b)}`;
}

/**
 * Het tenant-accent zoals het in dít thema getoond mag worden.
 *
 * Whitelabel betekent dat een sportschool élke kleur mag kiezen — ook een die
 * in één van de twee thema's wegvalt. Een zwart merk (#000000) is op de bijna
 * zwarte donkere modus onzichtbaar: `text-accent` op een `#111`-kaart haalt
 * 1,1:1, en de aurora-orbs (die van dit accent worden afgeleid) verdwijnen
 * volledig. Spiegelbeeld op licht: knalgeel op wit haalt 1,15:1.
 *
 * Daarom wordt het accent minimaal bijgemengd — naar wit op donker, naar zwart
 * op licht — tot het de 3:1-grens tegen het kaartoppervlak haalt. Een accent
 * dat al genoeg contrast heeft blijft **exact** ongewijzigd; het GymRebel-oranje
 * (5,68:1 op donker, 3,33:1 op licht) wordt dus nooit aangeraakt. De opgeslagen
 * `Tenant.accentColor` blijft de echte merkkleur: dit is puur een weergavelaag.
 *
 * Een niet-hex waarde (een CSS-kleurnaam bv.) gaat ongemoeid door — we kunnen er
 * geen luminantie van berekenen, en stil vervangen is erger dan niet corrigeren.
 */
export function accentForTheme(accent: string, theme: "light" | "dark"): string {
  if (!isHexColor(accent)) return accent;
  const surface = ACCENT_SURFACE[theme];
  if (contrastRatio(accent, surface) >= MIN_ACCENT_CONTRAST) return accent;

  const target = ACCENT_LIFT[theme];
  // Stappen van 4%: fijn genoeg om de merkkleur zo dicht mogelijk te benaderen,
  // grof genoeg om in één simpele lus te blijven.
  for (let step = 1; step <= 25; step++) {
    const candidate = mixHex(accent, target, step / 25);
    if (contrastRatio(candidate, surface) >= MIN_ACCENT_CONTRAST) return candidate;
  }
  // Onbereikbaar (puur wit/zwart haalt de grens altijd), maar nooit undefined.
  return target;
}
