import test from "node:test";
import assert from "node:assert/strict";
import {
  MIN_ACCENT_CONTRAST,
  accentForTheme,
  contrastRatio,
  readableText,
} from "../lib/color";

// `readableText` bepaalt de tekstkleur óp het tenant-accent: het knoplabel in
// élke uitgaande e-mail, de wordmark in de mailheader en de web-UI-variabele
// `--tenant-accent-foreground`. Een verkeerde keuze = onleesbare knoppen.

test("wit blijft de keuze op donkere en middeldonkere accenten", () => {
  assert.equal(readableText("#ff4d00"), "#ffffff"); // GymRebel-oranje
  assert.equal(readableText("#2563eb"), "#ffffff"); // blauw
  assert.equal(readableText("#16a34a"), "#ffffff"); // groen
  assert.equal(readableText("#111827"), "#ffffff"); // bijna zwart
});

test("lichte accenten krijgen donkere tekst i.p.v. wit-op-geel", () => {
  // De oude luminantie-grens (0,55) liet deze accenten wit houden: ~1,8:1.
  assert.equal(readableText("#e8b41f"), "#111827"); // okergeel
  assert.equal(readableText("#a3e635"), "#111827"); // limoen
  assert.equal(readableText("#facc15"), "#111827"); // geel
  assert.equal(readableText("#ffffff"), "#111827"); // wit
});

test("de gekozen tekstkleur haalt altijd minstens de 3:1-grens", () => {
  const accents = [
    "#ff4d00", "#2563eb", "#16a34a", "#111827", "#e8b41f", "#a3e635",
    "#facc15", "#ffffff", "#7c3aed", "#06b6d4", "#f472b6", "#84cc16",
  ];
  for (const accent of accents) {
    const ratio = contrastRatio(readableText(accent), accent);
    assert.ok(ratio >= 3, `${accent} → ${readableText(accent)} is maar ${ratio.toFixed(2)}:1`);
  }
});

test("e-mailpalet: elke tekst/achtergrond-combinatie is leesbaar", () => {
  // Spiegelt lib/email/layout.ts + components.ts. Licht = inline kleuren,
  // donker = de DARK_RULES. Kleine tekst (< 18px) vraagt 4,5:1.
  const pairs: [string, string, string][] = [
    ["body licht", "#1f2937", "#ffffff"],
    ["muted licht", "#6b7280", "#ffffff"],
    ["paneel licht", "#1f2937", "#f9fafb"],
    ["body donker", "#e5e7eb", "#111827"],
    ["muted donker", "#9ca3af", "#111827"],
    ["paneel donker", "#e5e7eb", "#1f2937"],
  ];
  for (const [label, fg, bg] of pairs) {
    const ratio = contrastRatio(fg, bg);
    assert.ok(ratio >= 4.5, `${label}: ${fg} op ${bg} = ${ratio.toFixed(2)}:1`);
  }
});

/* ------------------------------------------------------------------
 * accentForTheme — contrastgarantie op het tenant-accent
 * ------------------------------------------------------------------
 * Whitelabel laat élke merkkleur toe, ook een die in precies één thema
 * wegvalt. `accentForTheme` mengt zo'n kleur minimaal bij tot de 3:1-grens
 * tegen het kaartoppervlak (#ffffff licht / #111111 donker) en laat de rest
 * onaangeraakt. De opgeslagen Tenant.accentColor verandert nooit.
 */

// Het kaartoppervlak per thema; spiegelt --surface-1 in globals.css.
const SURFACE = { light: "#ffffff", dark: "#111111" } as const;
const THEMES = ["light", "dark"] as const;

test("een accent met genoeg contrast blijft exact ongewijzigd", () => {
  // Rebel Orange haalt 3,33:1 op wit en 5,68:1 op de donkere kaart. Het
  // platform-accent mag dus nooit stilletjes verschuiven — anders wijkt de
  // demo-tenant af van de hardgecodeerde fallback in globals.css.
  assert.equal(accentForTheme("#ff4d00", "light"), "#ff4d00");
  assert.equal(accentForTheme("#ff4d00", "dark"), "#ff4d00");
  assert.equal(accentForTheme("#2563eb", "light"), "#2563eb");
  assert.equal(accentForTheme("#16a34a", "dark"), "#16a34a");
});

test("een zwart merk wordt alléén in de donkere modus opgelicht", () => {
  // Fitness Fabriek Dokkum: #000000. Op wit is dat 21:1 (prima), op de bijna
  // zwarte donkere modus 1,11:1 — daar verdwijnt text-accent en de aurora.
  assert.equal(accentForTheme("#000000", "light"), "#000000");
  const dark = accentForTheme("#000000", "dark");
  assert.notEqual(dark, "#000000");
  assert.ok(contrastRatio(dark, SURFACE.dark) >= MIN_ACCENT_CONTRAST);
});

test("een knalgeel merk wordt alléén in de lichte modus verdonkerd", () => {
  // Spiegelbeeld: 16,42:1 op donker, 1,15:1 op wit.
  assert.equal(accentForTheme("#f7f700", "dark"), "#f7f700");
  const light = accentForTheme("#f7f700", "light");
  assert.notEqual(light, "#f7f700");
  assert.ok(contrastRatio(light, SURFACE.light) >= MIN_ACCENT_CONTRAST);
});

test("élk accent haalt in beide thema's de 3:1-grens tegen de kaart", () => {
  const accents = [
    "#ff4d00", "#000000", "#111111", "#f7f700", "#ffffff", "#1e3a8a",
    "#2563eb", "#16a34a", "#7c3aed", "#facc15", "#a3e635", "#f472b6",
    "#0f172a", "#fefce8", "#06b6d4",
  ];
  for (const accent of accents) {
    for (const theme of THEMES) {
      const shown = accentForTheme(accent, theme);
      const ratio = contrastRatio(shown, SURFACE[theme]);
      assert.ok(
        ratio >= MIN_ACCENT_CONTRAST,
        `${accent} (${theme}) → ${shown} is maar ${ratio.toFixed(2)}:1`,
      );
    }
  }
});

test("de correctie is idempotent — nog een ronde verandert niets meer", () => {
  for (const accent of ["#000000", "#f7f700", "#1e3a8a", "#ff4d00"]) {
    for (const theme of THEMES) {
      const once = accentForTheme(accent, theme);
      assert.equal(accentForTheme(once, theme), once);
    }
  }
});

test("de knoptekst blijft leesbaar óp het gecorrigeerde accent", () => {
  // --tenant-accent-fg-* wordt in app/layout.tsx van de gecorrigeerde kleur
  // afgeleid, niet van de ruwe merkkleur; die combinatie moet kloppen.
  for (const accent of ["#000000", "#f7f700", "#1e3a8a", "#ff4d00", "#ffffff"]) {
    for (const theme of THEMES) {
      const shown = accentForTheme(accent, theme);
      const ratio = contrastRatio(readableText(shown), shown);
      assert.ok(ratio >= 3, `${shown}: ${ratio.toFixed(2)}:1`);
    }
  }
});

test("een niet-hex kleur gaat ongemoeid door", () => {
  // Van een CSS-kleurnaam is geen luminantie te berekenen; stil vervangen is
  // erger dan niet corrigeren.
  assert.equal(accentForTheme("rebeccapurple", "dark"), "rebeccapurple");
  assert.equal(accentForTheme("", "light"), "");
});
