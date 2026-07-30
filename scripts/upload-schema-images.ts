// scripts/upload-schema-images.ts
//
// Haal de gecureerde omslagfoto's van de voorbeeldschema's op bij Pexels,
// normaliseer ze naar WebP en zet ze in de PUBLIEKE media-container onder
// `images/schema-templates/<slug>.webp`.
//
// - Bron van waarheid = `LIBRARY_TEMPLATE_PHOTOS` (lib/schema-image.ts). Nieuwe
//   foto = één record daar + dit script draaien. Het script verzint niets zelf.
// - Licentie: Pexels-licentie (gratis, commercieel gebruik toegestaan,
//   naamsvermelding niet verplicht). De bron-URL per foto staat in de log zodat
//   de herkomst controleerbaar blijft.
// - Doelcontainer wordt AFGELEID uit `LIBRARY_MEDIA_BASE_URL` — dezelfde bron
//   die de app leest. Zo kan het script nooit naar een andere container
//   schrijven dan waar de app kijkt (`AZURE_BLOB_CONTAINER` wijst bewust naar
//   de verouderde legacy-container en is hier dus níét bruikbaar).
// - Bijsnijden gebeurt hier, niet in de browser: de bronfoto's zijn deels
//   staand. `sharp`'s attention-strategie kiest het saillante deel, zodat een
//   16:9-kaart nooit een afgesneden hoofd toont.
// - Idempotent: bestaande blobs worden overgeslagen (`--force` overschrijft).
//
// Gebruik: npm run library:images [-- --force] [-- --only=<slug>] [-- --dry-run]

import "dotenv/config";
import { BlobServiceClient } from "@azure/storage-blob";
import sharp from "sharp";
import {
  LIBRARY_TEMPLATE_PHOTOS,
  libraryTemplatePhotoKey,
  pexelsSourceUrl,
  SCHEMA_COVER_HEIGHT,
  SCHEMA_COVER_WIDTH,
  type LibraryTemplatePhoto,
} from "../lib/schema-image";
import { libraryMediaBaseUrl } from "../lib/exercise-library/media";

/** Kaartformaat (3:2) — dezelfde verhouding als de cover in de UI. */
const WIDTH = SCHEMA_COVER_WIDTH;
const HEIGHT = SCHEMA_COVER_HEIGHT;
/** WebP-kwaliteit: ruim voldoende voor een sfeerfoto, ~60-90 kB per bestand. */
const QUALITY = 80;
const CONCURRENCY = 4;

const args = process.argv.slice(2);
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");
const only = args.find((a) => a.startsWith("--only="))?.slice("--only=".length);

function env(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    console.error(`✗ Ontbrekende env-variabele: ${name}`);
    process.exit(1);
  }
  return v;
}

/**
 * Containernaam uit de publieke basis-URL (laatste padsegment). Faalt hard bij
 * een basis-URL zonder container — beter dan stilletjes de verkeerde vullen.
 */
function containerFromBaseUrl(): string {
  const base = libraryMediaBaseUrl();
  const name = new URL(base).pathname.replace(/^\/+|\/+$/g, "");
  if (!name || name.includes("/")) {
    console.error(`✗ Kan containernaam niet afleiden uit LIBRARY_MEDIA_BASE_URL: ${base}`);
    process.exit(1);
  }
  return name;
}

/** Downloadadres van de bronfoto — ruim groter dan het eindformaat. */
function pexelsDownloadUrl(pexelsId: number): string {
  return `https://images.pexels.com/photos/${pexelsId}/pexels-photo-${pexelsId}.jpeg?auto=compress&cs=tinysrgb&w=1800`;
}

async function fetchPhoto(photo: LibraryTemplatePhoto): Promise<Buffer> {
  const res = await fetch(pexelsDownloadUrl(photo.pexelsId));
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 5_000) throw new Error(`verdacht klein bestand (${buf.length} bytes)`);
  return buf;
}

/**
 * Naar 3:2-WebP. `attention` laat sharp het saillante deel kiezen — prima bij
 * staande bronfoto's waar de sporter niet in het verticale midden staat, maar
 * niet bij donkere of wijd gekadreerde beelden. Vandaar de per-foto `focus`
 * uit de registry (zie `LibraryPhotoFocus`).
 */
async function toCoverWebp(input: Buffer, photo: LibraryTemplatePhoto): Promise<Buffer> {
  const position = photo.focus === "center" ? "center" : sharp.strategy.attention;
  return sharp(input)
    .resize(WIDTH, HEIGHT, { fit: "cover", position })
    .webp({ quality: QUALITY })
    .toBuffer();
}

// Simpele worker-pool (idioom scripts/upload-media.mjs).
async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<string>
): Promise<Record<string, number>> {
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
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => next())
  );
  return results;
}

async function main() {
  const connStr = env("AZURE_STORAGE_CONNECTION_STRING");
  const containerName = containerFromBaseUrl();

  let photos = Object.values(LIBRARY_TEMPLATE_PHOTOS);
  if (only) {
    photos = photos.filter((p) => p.slug === only);
    if (photos.length === 0) {
      console.error(`✗ Onbekende slug: ${only}`);
      process.exit(1);
    }
  }

  console.log(
    `Omslagfoto's voorbeeldschema's → container '${containerName}' (${photos.length} stuks, ${WIDTH}×${HEIGHT} WebP).`
  );
  console.log("Bron: Pexels (Pexels-licentie, commercieel gebruik toegestaan).");
  if (dryRun) console.log("• dry-run: er wordt niets geüpload.\n");

  const service = BlobServiceClient.fromConnectionString(connStr);
  const container = service.getContainerClient(containerName);
  // Publieke blob-read (geen container-listing) — zoals de bestaande media.
  if (!dryRun) {
    const created = await container.createIfNotExists({ access: "blob" });
    if (created.succeeded) console.log(`✓ Container '${containerName}' aangemaakt.`);
  }

  const worker = async (photo: LibraryTemplatePhoto): Promise<string> => {
    const key = libraryTemplatePhotoKey(photo.slug);
    const blob = container.getBlockBlobClient(key);

    if (!force && !dryRun) {
      try {
        await blob.getProperties();
        console.log(`• ${photo.slug} — bestaat al, overgeslagen`);
        return "skipped";
      } catch (err) {
        // 404 (BlobNotFound) is normaal: dan uploaden we.
        if ((err as { statusCode?: number }).statusCode !== 404) throw err;
      }
    }

    let raw: Buffer;
    try {
      raw = await fetchPhoto(photo);
    } catch (err) {
      throw new Error(`${photo.slug} — ${(err as Error).message} (${pexelsSourceUrl(photo.pexelsId)})`);
    }
    const webp = await toCoverWebp(raw, photo);

    if (dryRun) {
      console.log(
        `  ${photo.slug} → ${key} (${Math.round(webp.length / 1024)} kB) ← ${pexelsSourceUrl(photo.pexelsId)}`
      );
      return "planned";
    }

    await blob.uploadData(webp, {
      blobHTTPHeaders: {
        blobContentType: "image/webp",
        // Onveranderlijke, gecureerde asset: lang cachen mag.
        blobCacheControl: "public, max-age=31536000, immutable",
      },
    });
    console.log(
      `✓ ${photo.slug} → ${key} (${Math.round(webp.length / 1024)} kB) ← ${pexelsSourceUrl(photo.pexelsId)}`
    );
    return "uploaded";
  };

  const res = await runPool(photos, CONCURRENCY, worker);

  console.log("");
  console.log(
    `Klaar: ${res.uploaded ?? 0} geüpload, ${res.planned ?? 0} gepland, ${res.skipped ?? 0} overgeslagen, ${res.failed ?? 0} mislukt.`
  );
  console.log(`Basis-URL: ${libraryMediaBaseUrl()}/images/schema-templates/`);
  if ((res.failed ?? 0) > 0) process.exit(1);
}

main().catch((err) => {
  console.error("✗ Onverwachte fout:", err);
  process.exit(1);
});
