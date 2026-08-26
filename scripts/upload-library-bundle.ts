// scripts/upload-library-bundle.ts
//
// Zet een nieuwe RepDB-bundel op Azure — de tegenhanger van `library:import`,
// dat de bundel uit Azure LEEST. Twee bestemmingen, conform de licentie:
//
// - `images/**`            → de PUBLIEKE media-container (afgeleid uit
//                            LIBRARY_MEDIA_BASE_URL, net als upload-schema-images).
// - alle overige bestanden → de PRIVÉ bron-container (LIBRARY_SOURCE_CONTAINER,
//                            default `exercise-source`). Nooit publiek: de ruwe
//                            dataset mag niet in een open bucket.
//
// Idempotent op inhoud: een blob met dezelfde Content-MD5 wordt overgeslagen,
// een gewijzigd bestand (RepDB vervangt regelmatig clips/illustraties onder
// dezelfde naam) wordt overschreven. Er wordt NOOIT iets verwijderd — een
// tenant-oefening kan naar een oude key verwijzen en die moet blijven werken
// (zelfde principe als het retire-i.p.v.-delete van `library:import`).
//
// Sluit af met een manifest-controle: elk beeld dat `exercises.json` belooft
// (stills per stijl/variant, animatie bij animation=true, spier-/materiaal-
// iconen) moet ná de upload in de media-container staan. Ontbreekt er iets,
// dan is de lokale bundel onvolledig → opgesomd + exitcode 1, zodat een
// `library:import` erna niet stil naar 404's verwijst.
//
// Gebruik:
//   npm run library:upload -- [--bundle=repdb-bundle-standard] [--dry-run]
//                             [--force] [--skip-media] [--skip-source]

import "dotenv/config";
import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { libraryMediaBaseUrl } from "../lib/exercise-library/media";

const CONCURRENCY = 6;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const skipMedia = args.includes("--skip-media");
const skipSource = args.includes("--skip-source");
const bundleDir =
  args.find((a) => a.startsWith("--bundle="))?.slice("--bundle=".length) || "repdb-bundle-standard";

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".json": "application/json",
  ".md": "text/markdown; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".sql": "application/sql",
  ".sqlite": "application/vnd.sqlite3",
  ".ts": "text/plain; charset=utf-8",
};

function env(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    console.error(`✗ Ontbrekende env-variabele: ${name}`);
    process.exit(1);
  }
  return v;
}

/** Containernaam uit de publieke basis-URL (idioom upload-schema-images.ts). */
function containerFromBaseUrl(): string {
  const base = libraryMediaBaseUrl();
  const name = new URL(base).pathname.replace(/^\/+|\/+$/g, "");
  if (!name || name.includes("/")) {
    console.error(`✗ Kan containernaam niet afleiden uit LIBRARY_MEDIA_BASE_URL: ${base}`);
    process.exit(1);
  }
  return name;
}

function contentTypeFor(name: string): string {
  const dot = name.lastIndexOf(".");
  return CONTENT_TYPES[dot >= 0 ? name.slice(dot).toLowerCase() : ""] ?? "application/octet-stream";
}

type LocalFile = { path: string; key: string; size: number };

async function walk(dir: string, root: string, out: LocalFile[]): Promise<void> {
  for (const name of await readdir(dir)) {
    const path = join(dir, name);
    const s = await stat(path);
    if (s.isDirectory()) await walk(path, root, out);
    else if (s.isFile()) out.push({ path, key: relative(root, path).split(sep).join("/"), size: s.size });
  }
}

async function md5Of(path: string): Promise<string> {
  return createHash("md5").update(await readFile(path)).digest("hex");
}

/** Bestaande blobs met hun Content-MD5 (hex) — één listing i.p.v. één HEAD per bestand. */
async function remoteIndex(container: ContainerClient, prefix?: string): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  for await (const b of container.listBlobsFlat(prefix ? { prefix } : undefined)) {
    const md5 = b.properties.contentMD5;
    out.set(b.name, md5 ? Buffer.from(md5).toString("hex") : null);
  }
  return out;
}

async function runPool<T>(items: T[], worker: (item: T) => Promise<string>): Promise<Record<string, number>> {
  let index = 0;
  const results: Record<string, number> = {};
  async function next(): Promise<void> {
    while (index < items.length) {
      const item = items[index++];
      try {
        const r = await worker(item);
        results[r] = (results[r] ?? 0) + 1;
      } catch (err) {
        results.failed = (results.failed ?? 0) + 1;
        console.error(`  ✗ ${(err as Error).message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => next()));
  return results;
}

async function syncFiles(label: string, container: ContainerClient, files: LocalFile[], prefix?: string) {
  const remote = await remoteIndex(container, prefix);
  const total = files.length;
  let processed = 0;
  const changed: string[] = [];
  const results = await runPool(files, async (file) => {
    const local = await md5Of(file.path);
    const existing = remote.get(file.key);
    const outcome = existing === undefined ? "nieuw" : existing === local && !force ? "skipped" : "bijgewerkt";
    processed++;
    if (outcome !== "skipped") {
      changed.push(`${outcome === "nieuw" ? "+" : "~"} ${file.key}`);
      if (!dryRun) {
        await container.getBlockBlobClient(file.key).uploadFile(file.path, {
          blobHTTPHeaders: { blobContentType: contentTypeFor(file.key) },
        });
      }
    }
    if (processed % 200 === 0 || processed === total) console.log(`  … ${label} ${processed}/${total}`);
    return outcome;
  });
  changed.sort().forEach((line) => console.log(`  ${line}`));
  console.log(
    `${dryRun ? "[dry-run] " : ""}✓ ${label}: ${results.nieuw ?? 0} nieuw, ${results.bijgewerkt ?? 0} bijgewerkt, ` +
      `${results.skipped ?? 0} ongewijzigd${results.failed ? `, ${results.failed} MISLUKT` : ""}`
  );
  if (results.failed) process.exitCode = 1;
}

/** Alle beeld-keys die de bundel belooft (spiegel van lib/exercise-library/media.ts). */
async function manifestKeys(): Promise<string[]> {
  type Ex = { id: string; image_alias?: string; images?: Record<string, string[]>; animation?: boolean };
  const bundle = JSON.parse(await readFile(join(bundleDir, "exercises.json"), "utf8")) as {
    exercises: Ex[];
    muscles: Record<string, { image?: string }>;
    equipment: Record<string, { image?: string }>;
  };
  const keys = new Set<string>();
  for (const ex of bundle.exercises) {
    const slug = ex.image_alias?.trim() || ex.id;
    for (const [style, variants] of Object.entries(ex.images ?? {})) {
      for (const v of variants) keys.add(`images/${style}/${slug}-${v}.webp`);
    }
    if (ex.animation) keys.add(`images/animations/${slug}.webp`);
  }
  for (const m of Object.values(bundle.muscles)) if (m.image) keys.add(`images/muscles/${m.image}`);
  for (const e of Object.values(bundle.equipment)) if (e.image) keys.add(`images/equipment/${e.image}`);
  return [...keys].sort();
}

async function main() {
  const service = BlobServiceClient.fromConnectionString(env("AZURE_STORAGE_CONNECTION_STRING"));
  const sourceName = process.env.LIBRARY_SOURCE_CONTAINER || "exercise-source";
  const mediaName = containerFromBaseUrl();

  const all: LocalFile[] = [];
  await walk(bundleDir, bundleDir, all);
  const media = all.filter((f) => f.key.startsWith("images/"));
  const source = all.filter((f) => !f.key.startsWith("images/"));
  console.log(
    `Bundel '${bundleDir}': ${source.length} bronbestanden → privé '${sourceName}', ` +
      `${media.length} media-bestanden → publiek '${mediaName}'${dryRun ? " (dry-run)" : ""}`
  );

  if (!skipSource) {
    const container = service.getContainerClient(sourceName);
    if (!dryRun) await container.createIfNotExists(); // géén public access — licentie
    const access = (await container.getAccessPolicy().catch(() => null))?.blobPublicAccess;
    if (access) {
      console.error(`✗ Bron-container '${sourceName}' is publiek (${access}) — dat verbiedt de licentie. Gestopt.`);
      process.exit(1);
    }
    await syncFiles("bron", container, source);
  }

  const mediaContainer = service.getContainerClient(mediaName);
  if (!skipMedia) {
    if (!dryRun) await mediaContainer.createIfNotExists({ access: "blob" });
    await syncFiles("media", mediaContainer, media, "images/");
  }

  // --- Manifest-controle: staat alles wat de bundel belooft nu op Azure? ----
  const expected = await manifestKeys();
  const remote = await remoteIndex(mediaContainer, "images/");
  const local = new Set(media.map((f) => f.key));
  const missing = expected.filter((k) => !remote.has(k) && !(dryRun && local.has(k)));
  if (missing.length === 0) {
    console.log(`✓ Manifest: alle ${expected.length} beloofde beelden staan in '${mediaName}'.`);
  } else {
    console.error(
      `\n✗ Manifest: ${missing.length} van ${expected.length} beloofde beelden ontbreken in '${mediaName}' ` +
        `(en zitten niet in de lokale bundel). Haal de volledige bundel op en draai dit script opnieuw:`
    );
    missing.forEach((k) => console.error(`  - ${k}`));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
