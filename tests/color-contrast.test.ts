import test from "node:test";
import assert from "node:assert/strict";
import { contrastRatio, readableText } from "../lib/color";

// `readableText` bepaalt de tekstkleur óp het tenant-accent: het knoplabel in
// élke uitgaande e-mail, de wordmark in de mailheader en de web-UI-variabele
// `--tenant-accent-foreground`. Een verkeerde keuze = onleesbare knoppen.

test("wit blijft de keuze op donkere en middeldonkere accenten", () => {
  assert.equal(readableText("#e84b1f"), "#ffffff"); // GymRebel-oranje
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
    "#e84b1f", "#2563eb", "#16a34a", "#111827", "#e8b41f", "#a3e635",
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
