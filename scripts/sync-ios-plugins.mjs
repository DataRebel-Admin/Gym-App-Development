/**
 * Kopieert de eigen native iOS-plugins naar het gegenereerde Xcode-project.
 *
 *   node scripts/sync-ios-plugins.mjs          (of: npm run ios:plugins)
 *   node scripts/sync-ios-plugins.mjs --check  (alleen rapporteren, niets wijzigen)
 *
 * ## Waarom een script
 *
 * `ios/` wordt gegenereerd door `npx cap add ios` en is wegwerpbaar: wie de map
 * verwijdert en opnieuw aanmaakt, is alles kwijt wat daar met de hand in stond.
 * De bron staat daarom in `native/ios/` (versiebeheerd) en dit script zet hem op
 * z'n plek. Zelfde afweging als scripts/patch-ios-plist.mjs en de Android-iconen
 * in scripts/generate-brand-assets.ts.
 *
 * Draai dit ná `npx cap add ios` en ná `npx cap sync ios`.
 *
 * ## Wat dit script NIET doet
 *
 * Het bestand aan het Xcode-**target** toevoegen. Xcode compileert uitsluitend
 * wat in `project.pbxproj` staat, en dat bestand automatisch patchen is een
 * bekende bron van kapotte projecten: de structuur is een eigen formaat met
 * UUID-verwijzingen op vier plekken per bestand, en een fout maakt het project
 * onopenbaar. Eén keer slepen in Xcode is veiliger. Het script controleert wél
 * of het al gebeurd is, zodat je er niet achter komt doordat de plugin stil
 * ontbreekt (een niet-geregistreerde plugin geeft geen foutmelding: de
 * JS-aanroep valt gewoon in zijn catch en er gebeurt niets).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = join(ROOT, "native", "ios");
const TARGET_DIR = join(ROOT, "ios", "App", "App");
const PBXPROJ = join(ROOT, "ios", "App", "App.xcodeproj", "project.pbxproj");
const CHECK_ONLY = process.argv.includes("--check");

if (!existsSync(SOURCE_DIR)) {
  console.error(`\n✗ ${SOURCE_DIR} bestaat niet. Niets te synchroniseren.\n`);
  process.exit(1);
}

const sources = readdirSync(SOURCE_DIR).filter((name) => name.endsWith(".swift"));

if (sources.length === 0) {
  console.log("✓ Geen Swift-bronbestanden in native/ios, niets te doen.");
  process.exit(0);
}

if (!existsSync(TARGET_DIR)) {
  console.error(
    `\n✗ ${TARGET_DIR} niet gevonden.\n\n` +
      "  Het iOS-platform bestaat nog niet. Draai op een Mac (of macOS-CI-runner):\n" +
      "    npx cap add ios\n" +
      "    npx cap sync ios\n" +
      "    npm run ios:plist\n" +
      "    npm run ios:plugins\n"
  );
  process.exit(1);
}

// Ontbreekt project.pbxproj, dan is het project stuk of half gegenereerd; dan
// heeft kopiëren geen zin en is de registratiecontrole hieronder onmogelijk.
const project = existsSync(PBXPROJ) ? readFileSync(PBXPROJ, "utf8") : "";

const copied = [];
const unregistered = [];

for (const name of sources) {
  const target = join(TARGET_DIR, name);
  const source = readFileSync(join(SOURCE_DIR, name), "utf8");
  const current = existsSync(target) ? readFileSync(target, "utf8") : null;

  if (current !== source) {
    copied.push(name);
    if (!CHECK_ONLY) {
      mkdirSync(TARGET_DIR, { recursive: true });
      copyFileSync(join(SOURCE_DIR, name), target);
    }
  }

  if (project && !project.includes(name)) unregistered.push(name);
}

if (copied.length === 0) {
  console.log(`✓ iOS-plugins zijn actueel (${sources.length} bestand(en)).`);
} else if (CHECK_ONLY) {
  console.log("\nNiet actueel in ios/App/App:");
  for (const name of copied) console.log(`  ✗ ${name}`);
  console.log("\nDraai `npm run ios:plugins` om ze bij te werken.");
} else {
  console.log("\nGekopieerd naar ios/App/App:");
  for (const name of copied) console.log(`  ✓ ${name}`);
}

if (unregistered.length > 0) {
  console.log(
    "\n⚠ Nog niet aan het Xcode-target toegevoegd:\n" +
      unregistered.map((name) => `  • ${name}`).join("\n") +
      "\n\n  Open ios/App/App.xcworkspace, sleep het bestand vanuit Finder in de\n" +
      "  App-groep en vink target 'App' aan. Zonder die stap compileert Xcode het\n" +
      "  niet en doet de plugin stil niets.\n"
  );
}

// --check is een poortwachter voor CI: hij faalt zodra er iets te doen is.
if (CHECK_ONLY && (copied.length > 0 || unregistered.length > 0)) process.exit(1);
