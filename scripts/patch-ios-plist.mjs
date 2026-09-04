/**
 * Zet de verplichte Info.plist-sleutels voor de iOS-app.
 *
 *   node scripts/patch-ios-plist.mjs          (of: npm run ios:plist)
 *   node scripts/patch-ios-plist.mjs --check  (alleen rapporteren, niets wijzigen)
 *
 * ## Waarom een script en geen handmatige Xcode-stap
 *
 * `ios/` wordt gegenereerd door `npx cap add ios` en is daarmee wegwerpbaar: wie
 * de map verwijdert en opnieuw aanmaakt, is de handmatig getikte sleutels kwijt.
 * Apple keurt een app **af** zodra een permissie zonder uitleg wordt gevraagd, en
 * een ontbrekende NSPhotoLibraryUsageDescription laat de app zelfs *crashen* op
 * het moment dat iemand een foto kiest. Daarom staat het hier in code: idempotent,
 * herhaalbaar en net zo goed te draaien op een macOS-CI-runner als op een Mac.
 *
 * Draai dit ná `npx cap add ios` en ná `npx cap sync ios`.
 *
 * ## Wat dit script NIET doet
 *
 * Capabilities (Push Notifications, Associated Domains voor passkeys en universal
 * links) zijn *entitlements*, geen Info.plist-sleutels. Die horen bij het
 * provisioning profile en zet je in Xcode onder Signing & Capabilities, of via
 * fastlane. Zie docs/CAPACITOR.md.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLIST = join(ROOT, "ios", "App", "App", "Info.plist");
const CHECK_ONLY = process.argv.includes("--check");

/**
 * Sleutels die we garanderen. `value` is rauwe plist-XML, zodat zowel strings als
 * booleans en dicts in dezelfde tabel passen.
 *
 * De teksten zijn wat de gebruiker in de systeemdialoog leest. Apple beoordeelt
 * die op begrijpelijkheid: benoem concreet wát de app doet en waaróm, niet "deze
 * app heeft toegang nodig tot je camera".
 */
const KEYS = [
  {
    key: "NSCameraUsageDescription",
    value:
      "<string>GymRebel gebruikt de camera om de QR-code op een apparaat te scannen, " +
      "zodat je meteen de bijbehorende oefening en uitleg ziet.</string>",
    why: "QR-scanner bij de apparaten (html5-qrcode in de WebView).",
  },
  {
    key: "NSPhotoLibraryUsageDescription",
    value:
      "<string>GymRebel opent je fotobibliotheek als je zelf een foto kiest, " +
      "bijvoorbeeld bij het melden van een defect apparaat of voor je profielfoto.</string>",
    why:
      "Foto kiezen via <input type=\"file\">. Zonder deze sleutel crasht de app " +
      "op het moment dat de kiezer opent.",
  },
  {
    key: "NSFaceIDUsageDescription",
    value:
      "<string>GymRebel gebruikt Face ID om je snel en veilig in te laten loggen " +
      "zonder je wachtwoord te typen.</string>",
    why: "Biometrische login via passkeys (WebAuthn).",
  },
  {
    key: "ITSAppUsesNonExemptEncryption",
    value: "<false/>",
    why:
      "De app gebruikt alleen standaard HTTPS, wat vrijgesteld is. Scheelt bij " +
      "elke TestFlight-upload de exportvragenlijst.",
  },
  {
    key: "NSAppTransportSecurity",
    value:
      "<dict>\n" +
      "\t\t<!-- Alleen HTTPS. Geen uitzonderingen; spiegelt network_security_config.xml op Android. -->\n" +
      "\t\t<key>NSAllowsArbitraryLoads</key>\n" +
      "\t\t<false/>\n" +
      "\t</dict>",
    why: "App Transport Security expliciet dicht voor de productie-API.",
  },
  {
    key: "CFBundleDisplayName",
    value: "<string>GymRebel</string>",
    why: "Naam onder het app-icoon op het beginscherm.",
  },
];

if (!existsSync(PLIST)) {
  console.error(
    `\n✗ ${PLIST} niet gevonden.\n\n` +
      "  Het iOS-platform bestaat nog niet. Draai op een Mac (of macOS-CI-runner):\n" +
      "    npx cap add ios\n" +
      "    npx cap sync ios\n" +
      "    npm run ios:plist\n"
  );
  process.exit(1);
}

let plist = readFileSync(PLIST, "utf8");
const added = [];
const present = [];

for (const { key, value, why } of KEYS) {
  // Sleutel al aanwezig? Dan niets doen: handmatige aanpassingen blijven staan.
  if (new RegExp(`<key>${key}</key>`).test(plist)) {
    present.push(key);
    continue;
  }
  added.push({ key, why });
  if (CHECK_ONLY) continue;

  // Invoegen vlak vóór de afsluitende </dict> van de root.
  const marker = plist.lastIndexOf("</dict>");
  if (marker === -1) {
    console.error("✗ Onverwachte Info.plist-structuur: geen afsluitende </dict>.");
    process.exit(1);
  }
  plist =
    plist.slice(0, marker) +
    `\t<key>${key}</key>\n\t${value}\n` +
    plist.slice(marker);
}

if (present.length > 0) {
  console.log(`• Al aanwezig, ongemoeid gelaten: ${present.join(", ")}`);
}

if (added.length === 0) {
  console.log("✓ Info.plist is compleet, niets te doen.");
  process.exit(0);
}

if (CHECK_ONLY) {
  console.log("\nOntbreekt nog in Info.plist:");
  for (const { key, why } of added) console.log(`  ✗ ${key}\n      ${why}`);
  console.log("\nDraai `npm run ios:plist` om ze toe te voegen.");
  process.exit(1);
}

writeFileSync(PLIST, plist, "utf8");
console.log("\nToegevoegd aan Info.plist:");
for (const { key, why } of added) console.log(`  ✓ ${key}\n      ${why}`);
console.log(
  "\nNog handmatig in Xcode (Signing & Capabilities), want dit zijn entitlements:\n" +
    "  • Push Notifications\n" +
    "  • Associated Domains: webcredentials:<host> en applinks:<host>\n"
);
