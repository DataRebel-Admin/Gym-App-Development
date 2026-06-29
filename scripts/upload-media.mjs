// scripts/upload-media.mjs
//
// Upload de exercises-dataset media (images + videos) naar Azure Blob Storage.
// - Eén container, blob-namen behouden het pad: images/<bestand> en videos/<bestand>.
// - Idempotent: bestaande blobs met gelijke grootte worden overgeslagen.
// - Beperkte concurrency (CONCURRENCY) en voortgangslog.
//
// Gebruik: npm run media:upload

import "dotenv/config";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { BlobServiceClient } from "@azure/storage-blob";

const CONCURRENCY = 8;

const CONTENT_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
};

function env(name, required = true) {
  const v = process.env[name];
  if (required && (!v || v.trim() === "")) {
    console.error(`✗ Ontbrekende env-variabele: ${name}`);
    process.exit(1);
  }
  return v;
}

function contentTypeFor(filename) {
  const dot = filename.lastIndexOf(".");
  const ext = dot >= 0 ? filename.slice(dot).toLowerCase() : "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

// Simpele worker-pool: verwerkt `items` met max `concurrency` parallelle taken.
async function runPool(items, concurrency, worker) {
  let index = 0;
  const results = { uploaded: 0, skipped: 0, failed: 0 };
  async function next() {
    while (index < items.length) {
      const i = index++;
      try {
        const r = await worker(items[i], i);
        results[r] = (results[r] ?? 0) + 1;
      } catch (err) {
        results.failed++;
        console.error(`  ✗ ${items[i].blobName}: ${err.message}`);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => next())
  );
  return results;
}

async function collect(dir, prefix) {
  let names;
  try {
    names = await readdir(dir);
  } catch (err) {
    console.error(`✗ Kan map niet lezen: ${dir} (${err.message})`);
    process.exit(1);
  }
  const files = [];
  for (const name of names) {
    const localPath = join(dir, name);
    const s = await stat(localPath);
    if (!s.isFile()) continue;
    files.push({
      localPath,
      blobName: `${prefix}/${name}`,
      size: s.size,
      contentType: contentTypeFor(name),
    });
  }
  return files;
}

async function main() {
  const connStr = env("AZURE_STORAGE_CONNECTION_STRING");
  const containerName = env("AZURE_BLOB_CONTAINER");
  const datasetDir = env("DATASET_DIR");

  const service = BlobServiceClient.fromConnectionString(connStr);
  const container = service.getContainerClient(containerName);

  // Container aanmaken met anonieme blob-read (publieke read, geen container-listing).
  const created = await container.createIfNotExists({ access: "blob" });
  if (created.succeeded) {
    console.log(`✓ Container '${containerName}' aangemaakt (access: blob).`);
  } else {
    console.log(`• Container '${containerName}' bestaat al.`);
    // Zorg dat bestaande containers ook publieke blob-read hebben.
    try {
      await container.setAccessPolicy("blob");
    } catch {
      console.log("  (kon access policy niet aanpassen — mogelijk al correct of geen rechten)");
    }
  }

  const images = await collect(join(datasetDir, "images"), "images");
  const videos = await collect(join(datasetDir, "videos"), "videos");
  const all = [...images, ...videos];
  const total = all.length;
  console.log(`Gevonden: ${images.length} images + ${videos.length} videos = ${total} bestanden.`);

  let processed = 0;
  const logEvery = 50;

  const worker = async (file) => {
    const blob = container.getBlockBlobClient(file.blobName);

    // Idempotent: bestaande blob met gelijke grootte overslaan.
    try {
      const props = await blob.getProperties();
      if (props.contentLength === file.size) {
        processed++;
        return "skipped";
      }
    } catch (err) {
      // 404 (BlobNotFound) is normaal — dan uploaden we.
      if (err.statusCode !== 404) throw err;
    }

    await blob.uploadFile(file.localPath, {
      blobHTTPHeaders: { blobContentType: file.contentType },
    });
    processed++;
    if (processed % logEvery === 0 || processed === total) {
      console.log(`  uploaded/checked ${processed}/${total}`);
    }
    return "uploaded";
  };

  console.log(`Start upload met concurrency ${CONCURRENCY}…`);
  const res = await runPool(all, CONCURRENCY, worker);

  console.log("");
  console.log(`Klaar: ${res.uploaded ?? 0} geüpload, ${res.skipped ?? 0} overgeslagen, ${res.failed ?? 0} mislukt.`);
  console.log(`Basis-URL: ${container.url}`);
  if ((res.failed ?? 0) > 0) process.exit(1);
}

main().catch((err) => {
  console.error("✗ Onverwachte fout:", err);
  process.exit(1);
});
