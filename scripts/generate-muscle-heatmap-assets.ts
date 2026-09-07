// scripts/generate-muscle-heatmap-assets.ts
//
// Bouw de app-assets voor de anatomische spier-heatmap uit de RepDB-bundelmap
// `images/muscle_heatmap/` (v1.41+):
//
// 1. Verkleinde WebP-afgeleiden (basis + alle overlays, breedte
//    HEATMAP_ASSET_WIDTH) → de PUBLIEKE media-container onder
//    `images/muscle_heatmap_app/` — de originelen (basis ~3 MB) zijn te zwaar
//    voor mobiel. Doelcontainer afgeleid uit LIBRARY_MEDIA_BASE_URL (zoals
//    scripts/upload-schema-images.ts; nooit AZURE_BLOB_CONTAINER).
// 2. Per aanzicht een hit-test-indexkaart-PNG → `public/muscle-heatmap/`.
//    Pixelwaarde = index+1 van de zwaarst-dekkende spier (0 = geen), in de
//    volgorde van `heatmapViewMuscles()` (lib/muscle-heatmap.ts) — dat is het
//    contract met de client-component. Same-origin, dus canvas-leesbaar zonder
//    CORS-configuratie op de storage-account.
//
// Bron: de lokale bundelmap als die er staat, anders de al geüploade originelen
// in de publieke container. Idempotent op bestaan (`--force` overschrijft).
//
// Gebruik: npm run muscles:heatmap [-- --force] [-- --dry-run] [-- --bundle=<map>]

import "dotenv/config";
import { existsSync } from "node:fs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BlobServiceClient } from "@azure/storage-blob";
import sharp from "sharp";
import {
  HEATMAP_ASSET_WIDTH,
  HEATMAP_CANVAS,
  HEATMAP_HITMAP_WIDTH,
  heatmapBaseKey,
  heatmapOverlayKeys,
  heatmapSourceFiles,
  heatmapViewMuscles,
  type HeatmapView,
} from "../lib/muscle-heatmap";
import { libraryMediaBaseUrl } from "../lib/exercise-library/media";

const args = process.argv.slice(2);
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");
const bundleDir =
  args.find((a) => a.startsWith("--bundle="))?.slice("--bundle=".length) ??
  "repdb-bundle-standard";

const SOURCE_DIR = join(bundleDir, "images", "muscle_heatmap");
const VIEWS: HeatmapView[] = ["front", "back"];
const QUALITY = 82;

function env(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    console.error(`✗ Ontbrekende env-variabele: ${name}`);
    process.exit(1);
  }
  return v;
}

function containerFromBaseUrl(): string {
  const base = libraryMediaBaseUrl();
  const name = new URL(base).pathname.replace(/^\/+|\/+$/g, "");
  if (!name || name.includes("/")) {
    console.error(`✗ Kan containernaam niet afleiden uit LIBRARY_MEDIA_BASE_URL: ${base}`);
    process.exit(1);
  }
  return name;
}

const useLocal = existsSync(SOURCE_DIR);

/** Origineel ophalen: lokale bundelmap, anders de publieke container. */
async function loadSource(file: string): Promise<Buffer> {
  if (useLocal) return readFile(join(SOURCE_DIR, file));
  const url = `${libraryMediaBaseUrl()}/images/muscle_heatmap/${file}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`bron niet gevonden: ${url} (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * CORS-regel op het storage-account (GET/HEAD, elke origin). CSS `mask-image`
 * haalt beelden — anders dan `<img>` — als CORS-request op; zonder
 * `Access-Control-Allow-Origin` blokkeert de browser élke overlay en blijft
 * het figuur grijs. De container is al publiek leesbaar, dus `*` geeft niets
 * extra's vrij. Idempotent: bestaande regels blijven staan.
 */
async function ensureCors(service: BlobServiceClient): Promise<void> {
  const props = await service.getProperties();
  const cors = props.cors ?? [];
  const hasRule = cors.some(
    (r) => r.allowedOrigins === "*" && r.allowedMethods.toUpperCase().includes("GET")
  );
  if (hasRule) {
    console.log("• CORS-regel (GET, *) staat al op het storage-account.");
    return;
  }
  cors.push({
    allowedOrigins: "*",
    allowedMethods: "GET,HEAD,OPTIONS",
    allowedHeaders: "*",
    exposedHeaders: "*",
    maxAgeInSeconds: 86400,
  });
  await service.setProperties({ ...props, cors });
  console.log("✓ CORS-regel (GET, *) toegevoegd aan het storage-account.");
}

async function main() {
  const containerName = containerFromBaseUrl();
  console.log(
    `Spier-heatmap-assets → container '${containerName}' (breedte ${HEATMAP_ASSET_WIDTH}px) + public/muscle-heatmap/ (indexkaarten ${HEATMAP_HITMAP_WIDTH}px).`
  );
  console.log(`Bron: ${useLocal ? SOURCE_DIR : `${libraryMediaBaseUrl()}/images/muscle_heatmap/`}`);
  if (dryRun) console.log("• dry-run: er wordt niets geüpload of geschreven.");

  const service = dryRun
    ? null
    : BlobServiceClient.fromConnectionString(env("AZURE_STORAGE_CONNECTION_STRING"));
  const container = service?.getContainerClient(containerName) ?? null;
  if (service) await ensureCors(service);

  let uploaded = 0;
  let skipped = 0;

  async function uploadWebp(key: string, buf: Buffer): Promise<void> {
    if (dryRun || !container) {
      console.log(`  ${key} (${Math.round(buf.length / 1024)} kB) [dry-run]`);
      return;
    }
    const blob = container.getBlockBlobClient(key);
    if (!force) {
      try {
        await blob.getProperties();
        skipped++;
        return;
      } catch (err) {
        if ((err as { statusCode?: number }).statusCode !== 404) throw err;
      }
    }
    await blob.uploadData(buf, {
      blobHTTPHeaders: {
        blobContentType: "image/webp",
        blobCacheControl: "public, max-age=31536000, immutable",
      },
    });
    uploaded++;
  }

  for (const view of VIEWS) {
    const canvas = HEATMAP_CANVAS[view];
    const muscles = heatmapViewMuscles(view);
    console.log(`\n${view}: basis + ${muscles.length} spieren (L+R)…`);

    // 1. Basisfiguur
    const baseSrc = await loadSource(`${view}_base.webp`);
    const baseSmall = await sharp(baseSrc)
      .resize({ width: HEATMAP_ASSET_WIDTH })
      .webp({ quality: QUALITY })
      .toBuffer();
    await uploadWebp(heatmapBaseKey(view), baseSmall);

    // 2. Overlays (weergave) + 3. indexkaart (hit-testing) in één doorloop
    const hitW = HEATMAP_HITMAP_WIDTH;
    const hitH = Math.round((canvas.height / canvas.width) * hitW);
    const bestAlpha = new Uint8Array(hitW * hitH);
    const bestIndex = new Uint8Array(hitW * hitH); // 0 = geen spier

    for (const [i, name] of muscles.entries()) {
      const sources = heatmapSourceFiles(view, name);
      const targets = heatmapOverlayKeys(view, name);
      for (const [s, file] of sources.entries()) {
        const src = await loadSource(file);
        const small = await sharp(src)
          .resize({ width: HEATMAP_ASSET_WIDTH })
          .webp({ quality: QUALITY })
          .toBuffer();
        await uploadWebp(targets[s], small);

        const { data, info } = await sharp(src)
          .resize({ width: hitW, height: hitH, fit: "fill" })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        for (let p = 0; p < hitW * hitH; p++) {
          const a = data[p * info.channels + 3];
          if (a > bestAlpha[p]) {
            bestAlpha[p] = a;
            bestIndex[p] = i + 1;
          }
        }
      }
    }

    // Ruis wegfilteren: pixels met verwaarloosbare dekking tellen niet als raak.
    for (let p = 0; p < bestIndex.length; p++) {
      if (bestAlpha[p] < 24) bestIndex[p] = 0;
    }

    const png = await sharp(Buffer.from(bestIndex), {
      raw: { width: hitW, height: hitH, channels: 1 },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();
    if (!dryRun) {
      await mkdir(join("public", "muscle-heatmap"), { recursive: true });
      await writeFile(join("public", "muscle-heatmap", `${view}.png`), png);
    }
    console.log(
      `  ✓ indexkaart ${view}.png (${hitW}×${hitH}, ${Math.round(png.length / 1024)} kB, ${muscles.length} spieren)`
    );
  }

  console.log(`\nKlaar: ${uploaded} geüpload, ${skipped} overgeslagen (bestond al).`);
  console.log(`Basis-URL: ${libraryMediaBaseUrl()}/images/muscle_heatmap_app/`);
}

main().catch((err) => {
  console.error("✗ Onverwachte fout:", err);
  process.exit(1);
});
