// scripts/import-exercises.mjs
//
// Importeer de exercises-metadata in Neon PostgreSQL.
// - Voert eerst scripts/schema.sql uit (idempotent).
// - Zet image_url / gif_url om naar volledige Azure-URL's.
// - Bulk upsert in batches binnen één transactie (parameterized — geen string-concat).
//
// Gebruik: npm run data:import

import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const BATCH_SIZE = 200;
const COLUMNS = [
  "id",
  "name",
  "category",
  "body_part",
  "equipment",
  "target",
  "muscle_group",
  "secondary_muscles",
  "instructions",
  "instruction_steps",
  "image_url",
  "gif_url",
];

function env(name, required = true) {
  const v = process.env[name];
  if (required && (!v || v.trim() === "")) {
    console.error(`✗ Ontbrekende env-variabele: ${name}`);
    process.exit(1);
  }
  return v;
}

// Strip query-params die `pg` niet kent (Prisma's ?schema, libpq's channel_binding).
// SSL regelen we expliciet via de Pool-config hieronder.
function pgConnectionString() {
  const url = new URL(env("DATABASE_URL"));
  for (const p of ["schema", "channel_binding"]) url.searchParams.delete(p);
  return url.toString();
}

// Leid de publieke basis-URL van de container af uit de connection string,
// tenzij AZURE_BLOB_BASE_URL expliciet is gezet.
function blobBaseUrl() {
  const explicit = process.env.AZURE_BLOB_BASE_URL;
  if (explicit && explicit.trim() !== "") return explicit.replace(/\/+$/, "");

  const connStr = env("AZURE_STORAGE_CONNECTION_STRING");
  const container = env("AZURE_BLOB_CONTAINER");
  const parts = Object.fromEntries(
    connStr
      .split(";")
      .filter(Boolean)
      .map((kv) => {
        const i = kv.indexOf("=");
        return [kv.slice(0, i), kv.slice(i + 1)];
      })
  );
  const protocol = parts.DefaultEndpointsProtocol ?? "https";
  const account = parts.AccountName;
  const suffix = parts.EndpointSuffix ?? "core.windows.net";
  if (!account) {
    console.error(
      "✗ Kan AccountName niet uit AZURE_STORAGE_CONNECTION_STRING halen; zet AZURE_BLOB_BASE_URL handmatig."
    );
    process.exit(1);
  }
  return `${protocol}://${account}.blob.${suffix}/${container}`;
}

function rowFor(record, baseUrl) {
  return [
    record.id,
    record.name,
    record.category,
    record.body_part,
    record.equipment,
    record.target,
    record.muscle_group ?? null,
    Array.isArray(record.secondary_muscles) ? record.secondary_muscles : [],
    JSON.stringify(record.instructions ?? {}),
    record.instruction_steps != null ? JSON.stringify(record.instruction_steps) : null,
    `${baseUrl}/${record.image}`,
    `${baseUrl}/${record.gif_url}`,
  ];
}

function buildUpsert(batch, baseUrl) {
  const values = [];
  const tuples = [];
  let p = 1;
  for (const record of batch) {
    const row = rowFor(record, baseUrl);
    const placeholders = COLUMNS.map((_, i) => {
      // secondary_muscles is text[], instructions/instruction_steps zijn jsonb.
      const col = COLUMNS[i];
      if (col === "instructions" || col === "instruction_steps") return `$${p++}::jsonb`;
      return `$${p++}`;
    });
    tuples.push(`(${placeholders.join(", ")})`);
    values.push(...row);
  }

  const updates = COLUMNS.filter((c) => c !== "id")
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(", ");

  const sql =
    `INSERT INTO exercises (${COLUMNS.join(", ")})\n` +
    `VALUES ${tuples.join(", ")}\n` +
    `ON CONFLICT (id) DO UPDATE SET ${updates}`;

  return { sql, values };
}

async function main() {
  const datasetDir = env("DATASET_DIR");
  const baseUrl = blobBaseUrl();
  console.log(`Blob basis-URL: ${baseUrl}`);

  const dataPath = join(datasetDir, "data", "exercises.json");
  const raw = await readFile(dataPath, "utf8");
  const records = JSON.parse(raw);
  if (!Array.isArray(records)) {
    console.error("✗ exercises.json bevat geen JSON-array.");
    process.exit(1);
  }
  console.log(`Gelezen: ${records.length} records uit ${dataPath}`);

  const pool = new Pool({
    connectionString: pgConnectionString(),
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    // Schema (idempotent).
    const schemaSql = await readFile(join(__dirname, "schema.sql"), "utf8");
    await client.query(schemaSql);
    console.log("✓ Schema toegepast (scripts/schema.sql).");

    await client.query("BEGIN");
    let done = 0;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const { sql, values } = buildUpsert(batch, baseUrl);
      await client.query(sql, values);
      done += batch.length;
      console.log(`  upserted ${done}/${records.length}`);
    }
    await client.query("COMMIT");
    console.log("✓ Transactie gecommit.");

    const { rows } = await client.query("SELECT count(*)::int AS count FROM exercises");
    console.log(`Count-check: SELECT count(*) FROM exercises = ${rows[0].count}`);

    const sample = await client.query(
      "SELECT image_url, gif_url FROM exercises WHERE id = $1",
      ["0001"]
    );
    if (sample.rows[0]) {
      console.log("Steekproef id=0001:");
      console.log(`  image_url: ${sample.rows[0].image_url}`);
      console.log(`  gif_url:   ${sample.rows[0].gif_url}`);
    }
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("✗ Import mislukt:", err);
  process.exit(1);
});
