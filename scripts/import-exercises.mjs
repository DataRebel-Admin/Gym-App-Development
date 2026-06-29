// scripts/import-exercises.mjs
//
// Importeer de exercises-metadata in de Prisma-managed tabel `exercise_catalog`
// (model ExerciseCatalog — globaal, geen tenant/RLS).
// - Zet image_url / gif_url om naar volledige Azure-URL's.
// - Vertaalt instructies en->nl via Azure Translator (EU) en bewaart ze als
//   instructions.nl / instruction_steps.nl. Idempotent: bestaande nl-vertalingen
//   worden hergebruikt (niet opnieuw vertaald).
// - Bulk upsert in batches binnen één transactie (parameterized).
//
// Vereist dat `prisma migrate` de tabel al heeft aangemaakt.
// Gebruik: npm run data:import

import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const { Pool } = pg;

const TABLE = "exercise_catalog";
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
function pgConnectionString() {
  const url = new URL(env("DATABASE_URL"));
  for (const p of ["schema", "channel_binding"]) url.searchParams.delete(p);
  return url.toString();
}

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

// --- Azure Translator (en -> nl) -------------------------------------------

function translatorConfig() {
  const key = process.env.AZURE_TRANSLATOR_KEY;
  if (!key || key.trim() === "") return null; // vertaling optioneel
  const endpoint = (
    process.env.AZURE_TRANSLATOR_ENDPOINT ??
    "https://api.cognitive.microsofttranslator.com"
  ).replace(/\/+$/, "");
  const region = env("AZURE_TRANSLATOR_REGION");
  return { key, endpoint, region };
}

// Verdeel teksten in chunks binnen Azure-limieten (≤100 items, ≤50k tekens).
function chunkTexts(texts, maxItems = 90, maxChars = 45000) {
  const chunks = [];
  let cur = [];
  let curChars = 0;
  for (const t of texts) {
    const len = (t ?? "").length;
    if (cur.length > 0 && (cur.length >= maxItems || curChars + len > maxChars)) {
      chunks.push(cur);
      cur = [];
      curChars = 0;
    }
    cur.push(t);
    curChars += len;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function translateAll(texts, cfg) {
  if (texts.length === 0) return [];
  const out = [];
  const chunks = chunkTexts(texts);
  let done = 0;
  const url = `${cfg.endpoint}/translate?api-version=3.0&from=en&to=nl`;
  for (const chunk of chunks) {
    let attempt = 0;
    for (;;) {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": cfg.key,
          "Ocp-Apim-Subscription-Region": cfg.region,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk.map((t) => ({ Text: t ?? "" }))),
      });
      if (res.ok) {
        const j = await res.json();
        for (const item of j) out.push(item.translations[0].text);
        break;
      }
      // 429/5xx → exponentiële backoff (Azure F0 heeft strakke rate limits).
      if ((res.status === 429 || res.status >= 500) && attempt < 6) {
        const wait = Math.min(2 ** attempt * 1000, 30000);
        attempt++;
        console.log(`  · translator ${res.status}, retry in ${wait}ms…`);
        await sleep(wait);
        continue;
      }
      throw new Error(`Translator ${res.status}: ${await res.text()}`);
    }
    done += chunk.length;
    console.log(`  vertaald ${done}/${texts.length} fragmenten`);
  }
  return out;
}

// --- Rij-opbouw ------------------------------------------------------------

function rowFor(record, baseUrl, instructions, instructionSteps) {
  return [
    record.id,
    record.name,
    record.category,
    record.body_part,
    record.equipment,
    record.target,
    record.muscle_group ?? null,
    Array.isArray(record.secondary_muscles) ? record.secondary_muscles : [],
    JSON.stringify(instructions ?? {}),
    instructionSteps != null ? JSON.stringify(instructionSteps) : null,
    `${baseUrl}/${record.image}`,
    `${baseUrl}/${record.gif_url}`,
  ];
}

function buildUpsert(batch, baseUrl, nl) {
  const values = [];
  const tuples = [];
  let p = 1;
  for (const record of batch) {
    const merged = nl.get(record.id) ?? {
      instructions: record.instructions,
      instruction_steps: record.instruction_steps,
    };
    const row = rowFor(record, baseUrl, merged.instructions, merged.instruction_steps);
    const placeholders = COLUMNS.map((col) => {
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
    `INSERT INTO ${TABLE} (${COLUMNS.join(", ")})\n` +
    `VALUES ${tuples.join(", ")}\n` +
    `ON CONFLICT (id) DO UPDATE SET ${updates}`;

  return { sql, values };
}

// Bouw per record de samengevoegde instructions/instruction_steps mét nl-veld.
// Hergebruikt bestaande nl-vertalingen uit de DB; vertaalt alleen wat ontbreekt.
async function buildNlTranslations(records, existingNl, cfg) {
  const result = new Map(); // id -> { instructions, instruction_steps }

  // 1) Hergebruik bestaande nl waar mogelijk.
  const need = [];
  for (const rec of records) {
    const reuse = existingNl.get(rec.id);
    if (reuse) {
      const ins = { ...(rec.instructions ?? {}), nl: reuse.instructions_nl };
      const steps =
        rec.instruction_steps != null
          ? { ...rec.instruction_steps, ...(reuse.steps_nl ? { nl: reuse.steps_nl } : {}) }
          : null;
      result.set(rec.id, { instructions: ins, instruction_steps: steps });
    } else {
      need.push(rec);
    }
  }

  if (!cfg) {
    if (need.length > 0) {
      console.log(
        `• Geen AZURE_TRANSLATOR_KEY — ${need.length} records zonder nl-vertaling (alleen en/es/it/tr).`
      );
    }
    return result;
  }
  if (need.length === 0) {
    console.log("✓ Alle nl-vertalingen al aanwezig — niets te vertalen.");
    return result;
  }

  console.log(`Vertalen en→nl voor ${need.length} nieuwe records…`);

  // 2) Vlakke lijst van te vertalen fragmenten opbouwen.
  const flat = []; // { id, type: 'ins' | 'step', si }
  const texts = [];
  for (const rec of need) {
    const en = rec.instructions?.en;
    if (en) {
      flat.push({ id: rec.id, type: "ins" });
      texts.push(en);
    }
    const stepsEn = rec.instruction_steps?.en;
    if (Array.isArray(stepsEn)) {
      stepsEn.forEach((s, si) => {
        flat.push({ id: rec.id, type: "step", si });
        texts.push(s);
      });
    }
  }

  const translated = await translateAll(texts, cfg);

  // 3) Reconstrueer per record.
  const nlIns = new Map();
  const nlSteps = new Map();
  flat.forEach((f, idx) => {
    const t = translated[idx];
    if (f.type === "ins") {
      nlIns.set(f.id, t);
    } else {
      if (!nlSteps.has(f.id)) nlSteps.set(f.id, []);
      nlSteps.get(f.id)[f.si] = t;
    }
  });

  for (const rec of need) {
    const ins = { ...(rec.instructions ?? {}) };
    if (nlIns.has(rec.id)) ins.nl = nlIns.get(rec.id);
    let steps = null;
    if (rec.instruction_steps != null) {
      steps = { ...rec.instruction_steps };
      if (nlSteps.has(rec.id)) steps.nl = nlSteps.get(rec.id);
    }
    result.set(rec.id, { instructions: ins, instruction_steps: steps });
  }

  return result;
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
    // Bestaande nl-vertalingen ophalen (idempotentie).
    const existing = await client.query(
      `SELECT id, instructions, instruction_steps FROM ${TABLE}`
    );
    const existingNl = new Map();
    for (const r of existing.rows) {
      const ins = r.instructions ?? {};
      const steps = r.instruction_steps ?? {};
      if (ins.nl) {
        existingNl.set(r.id, {
          instructions_nl: ins.nl,
          steps_nl: Array.isArray(steps?.nl) ? steps.nl : null,
        });
      }
    }
    console.log(`Bestaande nl-vertalingen: ${existingNl.size}`);

    const cfg = translatorConfig();
    const nl = await buildNlTranslations(records, existingNl, cfg);

    await client.query("BEGIN");
    let done = 0;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const { sql, values } = buildUpsert(batch, baseUrl, nl);
      await client.query(sql, values);
      done += batch.length;
      console.log(`  upserted ${done}/${records.length}`);
    }
    await client.query("COMMIT");
    console.log("✓ Transactie gecommit.");

    const { rows } = await client.query(`SELECT count(*)::int AS count FROM ${TABLE}`);
    console.log(`Count-check: SELECT count(*) FROM ${TABLE} = ${rows[0].count}`);

    const sample = await client.query(
      `SELECT image_url, instructions->>'nl' AS nl FROM ${TABLE} WHERE id = $1`,
      ["0001"]
    );
    if (sample.rows[0]) {
      console.log("Steekproef id=0001:");
      console.log(`  image_url: ${sample.rows[0].image_url}`);
      console.log(`  nl:        ${(sample.rows[0].nl ?? "(geen)").slice(0, 90)}…`);
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
