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

/** Relatieve luminantie → kies wit of donkergrijs voor maximale leesbaarheid óp deze kleur. */
export function readableText(bg: string): string {
  return luminance(bg) > 0.55 ? "#111827" : "#ffffff";
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
