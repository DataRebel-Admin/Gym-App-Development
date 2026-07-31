/**
 * Eén bron van waarheid voor het versienummer van de **native apps**:
 * `app-version.json` in de repo-root.
 *
 *   npm run version:sync    schrijft de versie naar Android en iOS
 *   npm run version:bump    verhoogt het buildnummer met 1 en synchroniseert
 *   npm run version:check   controleert of alles gelijk loopt (voor CI)
 *
 * ## Twee getallen, twee betekenissen
 *
 * `version` (1.4.0) is de **marketingversie**: wat de gebruiker in de store ziet.
 * Semver, mag herhaald worden tussen platforms, mag omhoog springen.
 *
 * `build` (37) is het **buildnummer**: puur administratief, moet bij élke upload
 * omhoog, ook als de marketingversie gelijk blijft. Upload je twee keer build 37,
 * dan weigeren beide stores de tweede. Het is bewust één teller voor iOS en
 * Android samen: dat is makkelijker uit elkaar te houden dan twee tellers die uit
 * de pas lopen, en er is geen enkel nadeel aan een gat in de reeks.
 *
 * ## Niet te verwarren met de product-changelog
 *
 * `lib/changelog.ts` heeft ook een `version` ("2026.10"). Dat is een
 * *marketinglabel* voor de release notes richting sportschooleigenaren en staat
 * los van de store-binary. Ze mogen uit elkaar lopen; koppel ze niet.
 *
 * ## Werkwijze bij een release
 *
 * 1. Nieuwe functionaliteit → verhoog `version` in app-version.json.
 * 2. Elke upload naar TestFlight of Play → `npm run version:bump`.
 * 3. Commit `app-version.json` samen met de gewijzigde native bestanden.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VERSION_FILE = join(ROOT, "app-version.json");
const GRADLE = join(ROOT, "android", "app", "build.gradle");
const PLIST = join(ROOT, "ios", "App", "App", "Info.plist");

const BUMP = process.argv.includes("--bump");
const CHECK = process.argv.includes("--check");

const meta = JSON.parse(readFileSync(VERSION_FILE, "utf8"));

if (!/^\d+\.\d+\.\d+$/.test(meta.version)) {
  console.error(`✗ "version" moet de vorm x.y.z hebben, niet "${meta.version}".`);
  process.exit(1);
}
if (!Number.isInteger(meta.build) || meta.build < 1) {
  console.error(`✗ "build" moet een positief geheel getal zijn, niet "${meta.build}".`);
  process.exit(1);
}

if (BUMP) {
  meta.build += 1;
  writeFileSync(VERSION_FILE, JSON.stringify(meta, null, 2) + "\n", "utf8");
  console.log(`↑ buildnummer verhoogd naar ${meta.build}`);
}

const { version, build } = meta;
const problems = [];

// ── Android ──────────────────────────────────────────────────────────────────
// versionCode = build (moet strikt stijgen), versionName = marketingversie.
if (existsSync(GRADLE)) {
  const before = readFileSync(GRADLE, "utf8");
  const after = before
    .replace(/versionCode\s+\d+/, `versionCode ${build}`)
    .replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);

  if (!/versionCode\s+\d+/.test(before) || !/versionName\s+"[^"]*"/.test(before)) {
    problems.push("android/app/build.gradle: versionCode of versionName niet gevonden");
  } else if (before !== after) {
    if (CHECK) problems.push(`android/app/build.gradle loopt achter (verwacht ${version} / ${build})`);
    else {
      writeFileSync(GRADLE, after, "utf8");
      console.log(`✓ android/app/build.gradle → versionName "${version}", versionCode ${build}`);
    }
  } else {
    console.log(`• android/app/build.gradle stond al op ${version} / ${build}`);
  }
} else {
  console.log("• android/ niet aanwezig — overgeslagen.");
}

// ── iOS ──────────────────────────────────────────────────────────────────────
// CFBundleShortVersionString = marketingversie, CFBundleVersion = buildnummer.
if (existsSync(PLIST)) {
  let plist = readFileSync(PLIST, "utf8");
  const original = plist;

  /** Vervangt de <string> die direct volgt op <key>naam</key>, of voegt 'm toe. */
  function setKey(key, value) {
    const pattern = new RegExp(`(<key>${key}</key>\\s*<string>)[^<]*(</string>)`);
    if (pattern.test(plist)) {
      plist = plist.replace(pattern, `$1${value}$2`);
      return;
    }
    const marker = plist.lastIndexOf("</dict>");
    plist = plist.slice(0, marker) + `\t<key>${key}</key>\n\t<string>${value}</string>\n` + plist.slice(marker);
  }

  setKey("CFBundleShortVersionString", version);
  setKey("CFBundleVersion", String(build));

  if (plist !== original) {
    if (CHECK) problems.push(`ios/App/App/Info.plist loopt achter (verwacht ${version} / ${build})`);
    else {
      writeFileSync(PLIST, plist, "utf8");
      console.log(`✓ ios/App/App/Info.plist → ${version} (build ${build})`);
    }
  } else {
    console.log(`• ios/App/App/Info.plist stond al op ${version} / ${build}`);
  }
} else {
  console.log("• ios/ niet aanwezig — overgeslagen (vereist macOS).");
}

if (problems.length > 0) {
  console.error("\n✗ Versies lopen niet gelijk:");
  for (const p of problems) console.error(`  • ${p}`);
  console.error("\nDraai `npm run version:sync`.");
  process.exit(1);
}

console.log(`\nApp-versie: ${version} (build ${build})`);
