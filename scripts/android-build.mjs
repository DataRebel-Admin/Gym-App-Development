/**
 * Bouwt de Android-release zonder dat je zelf aan `JAVA_HOME` of aan vastgelopen
 * build-mappen hoeft te denken.
 *
 *   npm run android:bundle    AAB voor de Play Console (:app:bundleRelease)
 *   npm run android:apk       APK om zelf op een toestel te zetten
 *
 * Vlaggen: `--no-sync` (sla `npx cap sync android` over), `--task=<gradle-taak>`.
 *
 * ## Waarom dit script bestaat
 *
 * Twee dingen lieten de release-build op deze machine structureel struikelen, en
 * geen van beide zegt in de foutmelding wat je moet doen:
 *
 * 1. **De JDK.** `gradlew.bat` stopt meteen als er geen `JAVA_HOME` staat, en de
 *    meegeleverde JBR van Android Studio staat inmiddels op Java 25
 *    (klassebestandversie 69). Gradle 8.14.3 kan daar niet mee bouwen: dat
 *    knalt in de configuratiefase, nog voor er iets gecompileerd is. Dit script
 *    zoekt daarom zelf een JDK in het ondersteunde bereik (zie MIN/MAX_MAJOR) en
 *    zet `JAVA_HOME` alleen voor deze ene aanroep, zodat je shell schoon blijft.
 *
 * 2. **OneDrive.** De repo staat in een gesynchroniseerde map, dus OneDrive geeft
 *    build-uitvoer een alleen-lezen-attribuut en een reparse point. Gradle kan
 *    zijn eigen tussenbestanden dan niet meer vervangen en faalt met
 *    `AccessDeniedException` of `Unable to delete directory`. Dat is geen
 *    kapotte build maar een vergrendeld bestand, dus ruimt dit script het
 *    genoemde pad op en probeert het één keer opnieuw.
 *
 * Structureel is de oplossing voor 2 om `android/build`, `android/app/build` en
 * `node_modules` uit te sluiten van OneDrive-synchronisatie. Zolang dat niet
 * gebeurd is, vangt dit script het af.
 */
import { spawn } from "node:child_process";
import { chmodSync, existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IS_WINDOWS = process.platform === "win32";

/** Bereik dat Gradle 8.14.3 als bouw-JVM aankan. Java 25 valt er bewust buiten. */
const MIN_MAJOR = 17;
const MAX_MAJOR = 24;

const args = process.argv.slice(2);
const SYNC = !args.includes("--no-sync");
const TASK = args.find((a) => a.startsWith("--task="))?.slice(7) ?? ":app:bundleRelease";

/* ------------------------------------------------------------------ JDK ---- */

/** Hoofdversie uit het `release`-bestand in een JDK-map, zonder java te starten. */
function javaMajor(home) {
  try {
    const line = readFileSync(join(home, "release"), "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("JAVA_VERSION="));
    if (!line) return null;
    const version = line.split("=")[1].replace(/"/g, "").trim();
    // "21.0.11" → 21, maar ook "1.8.0_402" → 8.
    const parts = version.split(".").map(Number);
    return parts[0] === 1 ? parts[1] : parts[0];
  } catch {
    return null;
  }
}

/** Mappen die op deze machine een JDK kunnen bevatten, in volgorde van voorkeur. */
function jdkCandidates() {
  const out = [];
  const push = (p) => {
    if (p && existsSync(join(p, "bin", IS_WINDOWS ? "java.exe" : "java"))) out.push(p);
  };
  const expand = (dir) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) push(join(dir, name));
  };

  push(process.env.GYMREBEL_JDK);
  push(process.env.JAVA_HOME);
  expand(join(homedir(), ".jdks"));
  expand("C:/Program Files/Eclipse Adoptium");
  expand("C:/Program Files/Java");
  expand(join(homedir(), ".sdkman/candidates/java"));
  push("C:/Program Files/Android/Android Studio/jbr");
  return out;
}

/** Nieuwste JDK binnen het ondersteunde bereik. */
function findJdk() {
  const usable = [];
  for (const home of jdkCandidates()) {
    const major = javaMajor(home);
    if (major !== null && major >= MIN_MAJOR && major <= MAX_MAJOR) usable.push({ home, major });
  }
  usable.sort((a, b) => b.major - a.major);
  return usable[0] ?? null;
}

/* -------------------------------------------------- vergrendelde mappen ---- */

/** Paden uit de Gradle-uitvoer die op een vergrendeld bestand wijzen. */
function lockedPaths(output) {
  const found = new Set();
  const patterns = [
    /AccessDeniedException:\s*(.+)/g,
    /Unable to delete directory '([^']+)'/g,
    /Unable to delete file '([^']+)'/g,
  ];
  for (const re of patterns) {
    for (const match of output.matchAll(re)) {
      const path = resolve(match[1].trim());
      // Nooit buiten de repo opruimen, hoe de foutmelding er ook uitziet.
      if (path.startsWith(resolve(ROOT)) && existsSync(path)) found.add(path);
    }
  }
  return [...found];
}

/** Verwijdert een pad en haalt eerst het alleen-lezen-attribuut van OneDrive weg. */
function forceRemove(path) {
  const clear = (p) => {
    try {
      chmodSync(p, 0o666);
    } catch {
      /* attribuut laat zich niet zetten, rmSync mag het alsnog proberen */
    }
    let entries = [];
    try {
      entries = statSync(p).isDirectory() ? readdirSync(p) : [];
    } catch {
      return;
    }
    for (const name of entries) clear(join(p, name));
  };
  clear(path);
  rmSync(path, { recursive: true, force: true, maxRetries: 3 });
}

/* ------------------------------------------------------------- uitvoer ---- */

/** Draait een commando, toont de uitvoer live én geeft haar terug voor analyse. */
function run(command, commandArgs, env) {
  return new Promise((resolveRun) => {
    const child = spawn(command, commandArgs, {
      cwd: ROOT,
      env: { ...process.env, ...env },
      shell: IS_WINDOWS, // .bat en npx zijn op Windows geen echte executables
    });
    let output = "";
    const tee = (stream, target) => {
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => {
        output += chunk;
        target.write(chunk);
      });
    };
    tee(child.stdout, process.stdout);
    tee(child.stderr, process.stderr);
    child.on("close", (code) => resolveRun({ code: code ?? 1, output }));
  });
}

function gradle(jdk) {
  const wrapper = IS_WINDOWS ? "android\\gradlew.bat" : "./android/gradlew";
  return run(wrapper, ["-p", "android", TASK, "--console=plain"], { JAVA_HOME: jdk.home });
}

/* --------------------------------------------------------- samenvatting ---- */

function summarize() {
  const meta = JSON.parse(readFileSync(join(ROOT, "app-version.json"), "utf8"));
  const config = join(ROOT, "android/app/src/main/assets/capacitor.config.json");
  const serverUrl = existsSync(config) ? JSON.parse(readFileSync(config, "utf8")).server?.url : null;

  const artifact = TASK.includes("bundle")
    ? join(ROOT, "android/app/build/outputs/bundle/release/app-release.aab")
    : join(ROOT, "android/app/build/outputs/apk/release/app-release.apk");

  console.log(`\nVersie: ${meta.version} (build ${meta.build})`);
  console.log(`Server: ${serverUrl ?? "onbekend"}`);
  if (existsSync(artifact)) {
    const info = statSync(artifact);
    const mb = (info.size / 1024 / 1024).toFixed(2);
    console.log(`Bestand: ${artifact}`);
    console.log(`         ${mb} MB, ${info.mtime.toLocaleString("nl-NL")}`);
  } else {
    console.log(`Bestand: niet gevonden op ${artifact}`);
  }
  if (serverUrl && !serverUrl.startsWith("https://app.")) {
    console.log("\n⚠ De server-URL wijst niet naar productie. Niet uploaden.");
  }
}

/* ---------------------------------------------------------------- main ---- */

const jdk = findJdk();
if (!jdk) {
  console.error(
    `Geen bruikbare JDK gevonden (Java ${MIN_MAJOR} t/m ${MAX_MAJOR}).\n` +
      "Installeer er een, bijvoorbeeld met:\n" +
      "  winget install EclipseAdoptium.Temurin.21.JDK\n" +
      "of wijs er zelf een aan met GYMREBEL_JDK=<pad naar de JDK-map>."
  );
  process.exit(1);
}
console.log(`JDK: Java ${jdk.major} (${jdk.home})`);

if (SYNC) {
  const sync = await run("npx", ["cap", "sync", "android"], {});
  if (sync.code !== 0) {
    console.error("\n`npx cap sync android` faalde, build afgebroken.");
    process.exit(sync.code);
  }
}

console.log(`\nGradle: ${TASK}`);
let result = await gradle(jdk);

if (result.code !== 0) {
  const locked = lockedPaths(result.output);
  if (locked.length > 0) {
    console.log("\nVergrendelde build-uitvoer opgeruimd (OneDrive):");
    for (const path of locked) {
      try {
        forceRemove(path);
        console.log(`  • ${path}`);
      } catch (error) {
        console.log(`  • ${path} (mislukt: ${error.message})`);
      }
    }
    console.log("\nOpnieuw proberen...\n");
    result = await gradle(jdk);
  }
}

if (result.code !== 0) {
  console.error("\nBuild mislukt.");
  process.exit(result.code);
}

summarize();
