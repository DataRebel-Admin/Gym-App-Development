// scripts/blob-copy-container.mjs
//
// Kopieer alle blobs van de ene Azure-container naar de andere. Azure kán een
// container niet hernoemen — "hernoemen" is dus copy + (later) delete van de bron.
//
// - Server-side copy (`beginCopyFromURL`): de bytes gaan nooit over deze machine.
//   Binnen hetzelfde account is dat vrijwel instant en gratis.
// - Idempotent: een doel-blob die al bestaat met dezelfde grootte wordt overgeslagen,
//   dus je kunt het script veilig opnieuw draaien na een afgebroken run.
// - Verwijdert NOOIT iets. De bron opruimen doe je bewust met `--delete-source`
//   ná verificatie (en na het herschrijven van opgeslagen URL's!).
//
// Gebruik:
//   node scripts/blob-copy-container.mjs --from=exercise-media --to=exercise-media-legacy
//   node scripts/blob-copy-container.mjs --from=x --to=y --delete-source   (destructief)
//
// Optioneel (container splitsen, bv. media publiek / ruwe dataset privé):
//   --prefix=images/          alleen blobs met deze prefix kopiëren
//   --exclude-prefix=images/  alles behálve deze prefix kopiëren
//   --access=private|blob     toegangsniveau van het doel afdwingen (default: als bron)
// Met een actief filter weigert --delete-source (de bron bevat dan meer dan het doel);
// de bron ruim je pas op nadat álle delen gekopieerd en geverifieerd zijn.

import "dotenv/config";
import { BlobServiceClient } from "@azure/storage-blob";

const CONCURRENCY = 16;

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  return process.argv.includes(`--${name}`) ? true : fallback;
}

function env(name) {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    console.error(`✗ Ontbrekende env-variabele: ${name}`);
    process.exit(1);
  }
  return v;
}

async function runPool(items, concurrency, worker) {
  let index = 0;
  const tally = { copied: 0, skipped: 0, failed: 0 };
  async function next() {
    while (index < items.length) {
      const item = items[index++];
      try {
        tally[await worker(item)]++;
      } catch (err) {
        tally.failed++;
        console.error(`  ✗ ${item.name}: ${err.message}`);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => next())
  );
  return tally;
}

async function main() {
  const from = arg("from");
  const to = arg("to");
  const deleteSource = arg("delete-source") === true;
  const prefix = arg("prefix", "") || "";
  const excludePrefix = arg("exclude-prefix", "") || "";
  const accessOverride = arg("access", null);
  if (!from || !to || from === to) {
    console.error("Gebruik: --from=<container> --to=<container> [--delete-source]");
    process.exit(1);
  }
  if (deleteSource && (prefix || excludePrefix)) {
    console.error("✗ --delete-source kan niet samen met een prefix-filter (bron ≠ doel).");
    process.exit(1);
  }
  const included = (name) =>
    (!prefix || name.startsWith(prefix)) &&
    (!excludePrefix || !name.startsWith(excludePrefix));

  const service = BlobServiceClient.fromConnectionString(
    env("AZURE_STORAGE_CONNECTION_STRING")
  );
  const src = service.getContainerClient(from);
  const dst = service.getContainerClient(to);

  if (!(await src.exists())) {
    console.error(`✗ Bron-container '${from}' bestaat niet.`);
    process.exit(1);
  }

  // Doel krijgt hetzelfde toegangsniveau als de bron — anders breken bestaande
  // publieke URL's (of maak je per ongeluk iets openbaar dat privé was).
  // Met --access dwing je expliciet een niveau af (bv. privé voor ruwe data).
  const srcProps = await src.getProperties();
  const access =
    accessOverride === "private"
      ? undefined
      : accessOverride === "blob"
        ? "blob"
        : (srcProps.blobPublicAccess ?? undefined);
  const created = await dst.createIfNotExists(access ? { access } : {});
  console.log(
    created.succeeded
      ? `✓ Container '${to}' aangemaakt (access: ${access ?? "private"}).`
      : `• Container '${to}' bestaat al.`
  );
  if (!created.succeeded && accessOverride) {
    // Bestaande container: niveau alsnog gelijktrekken met wat gevraagd is.
    await dst.setAccessPolicy(access);
    console.log(`  toegangsniveau gezet op: ${access ?? "private"}`);
  }

  console.log(`Bron '${from}' inventariseren…`);
  const items = [];
  for await (const b of src.listBlobsFlat()) {
    if (!included(b.name)) continue;
    items.push({ name: b.name, size: b.properties.contentLength ?? 0 });
  }
  console.log(
    `Gevonden: ${items.length} blobs` +
      (prefix || excludePrefix
        ? ` (filter: ${prefix ? `prefix=${prefix}` : ""}${excludePrefix ? ` exclude=${excludePrefix}` : ""})`
        : "") +
      "."
  );

  let done = 0;
  const worker = async (item) => {
    const target = dst.getBlockBlobClient(item.name);

    try {
      const props = await target.getProperties();
      if (props.contentLength === item.size) {
        done++;
        return "skipped";
      }
    } catch (err) {
      if (err.statusCode !== 404) throw err;
    }

    // Publieke container → directe URL volstaat. Privé → SAS zou nodig zijn;
    // dat meldt Azure dan expliciet met een 403 (CannotVerifyCopySource).
    const sourceUrl = src.getBlockBlobClient(item.name).url;
    const poller = await target.beginCopyFromURL(sourceUrl);
    const result = await poller.pollUntilDone();
    if (result.copyStatus !== "success") {
      throw new Error(`copyStatus=${result.copyStatus}`);
    }
    done++;
    if (done % 200 === 0) console.log(`  … ${done}/${items.length}`);
    return "copied";
  };

  const tally = await runPool(items, CONCURRENCY, worker);
  console.log(
    `\nKlaar: ${tally.copied} gekopieerd, ${tally.skipped} overgeslagen, ${tally.failed} mislukt.`
  );

  // Verificatie: telling + totale bytes moeten gelijk zijn vóór welke delete dan ook.
  // De bron telt alleen wat binnen het filter valt (dat is wat gekopieerd hoort te zijn).
  const summarize = async (client, filter) => {
    let count = 0;
    let bytes = 0;
    for await (const b of client.listBlobsFlat()) {
      if (filter && !filter(b.name)) continue;
      count++;
      bytes += b.properties.contentLength ?? 0;
    }
    return { count, bytes };
  };
  const a = await summarize(src, included);
  const b = await summarize(dst, null);
  console.log(`bron  '${from}' (gefilterd): ${a.count} blobs, ${a.bytes} bytes`);
  console.log(`doel  '${to}': ${b.count} blobs, ${b.bytes} bytes`);
  const identical = a.count === b.count && a.bytes === b.bytes;
  console.log(identical ? "✓ Identiek." : "✗ NIET identiek — bron niet verwijderen.");

  if (!deleteSource) {
    if (identical) {
      console.log(
        `\nBron staat er nog. Opruimen kan met --delete-source (doe dit pas nadat` +
          ` opgeslagen URL's naar '${to}' verwijzen).`
      );
    }
    if (tally.failed > 0) process.exitCode = 1;
    return;
  }

  if (!identical || tally.failed > 0) {
    console.error("✗ Weiger te verwijderen: kopie is niet aantoonbaar compleet.");
    process.exitCode = 1;
    return;
  }
  await src.delete();
  console.log(`✓ Bron-container '${from}' verwijderd.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
