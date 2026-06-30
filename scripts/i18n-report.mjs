/**
 * i18n-vertaalrapport. Vergelijkt elke locale-catalogus met de NL-bron en lijst
 * ontbrekende (→ vallen runtime terug op NL) en overbodige sleutels.
 *
 *   npm run i18n:report
 *
 * Idempotent, alleen-lezen. Bedoeld om FY (en EN) af te maken en drift te zien.
 * Exit-code 0 (informatief); zet I18N_STRICT=1 om te falen bij ontbrekende keys.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const messagesDir = join(here, "..", "messages");

const BASE = "nl";
const LOCALES = ["nl", "en", "fy"];

function load(locale) {
  return JSON.parse(readFileSync(join(messagesDir, `${locale}.json`), "utf8"));
}

/** Platte set van alle sleutelpaden (bladeren) in een geneste catalogus. */
function flatten(obj, prefix = "", out = new Set()) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out.add(path);
    }
  }
  return out;
}

const base = flatten(load(BASE));
let totalMissing = 0;

console.log(`\n  i18n-rapport — basis: ${BASE} (${base.size} sleutels)\n`);

for (const locale of LOCALES) {
  if (locale === BASE) continue;
  const keys = flatten(load(locale));
  const missing = [...base].filter((k) => !keys.has(k)).sort();
  const extra = [...keys].filter((k) => !base.has(k)).sort();
  const translated = base.size - missing.length;
  const pct = Math.round((translated / base.size) * 100);
  totalMissing += missing.length;

  console.log(`  ${locale.toUpperCase()}  ${translated}/${base.size} vertaald (${pct}%)`);
  if (missing.length) {
    console.log(`    ⨯ ontbreekt (${missing.length}, → NL-fallback):`);
    for (const k of missing) console.log(`        ${k}`);
  }
  if (extra.length) {
    console.log(`    ! overbodig (${extra.length}, niet in NL):`);
    for (const k of extra) console.log(`        ${k}`);
  }
  console.log("");
}

if (process.env.I18N_STRICT === "1" && totalMissing > 0) {
  console.error(`  STRICT: ${totalMissing} ontbrekende sleutel(s).`);
  process.exit(1);
}
