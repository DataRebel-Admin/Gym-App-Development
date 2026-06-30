// scripts/export-untranslated.mjs
//
// Backfill-hulp (eenmalig): exporteer alle exercise_catalog-records die nog géén
// nl-vertaling hebben (instructions zonder 'nl') naar een JSON-bestand, zodat de
// vertaling in-sessie kan gebeuren. Alleen de Engelse bron wordt meegegeven.
//
// Gebruik: node scripts/export-untranslated.mjs <uitvoerpad.json> [limit] [offset]

import "dotenv/config";
import { writeFile } from "node:fs/promises";
import pg from "pg";

const { Pool } = pg;

function pgConnectionString() {
  const url = new URL(process.env.DATABASE_URL);
  for (const p of ["schema", "channel_binding", "sslmode"]) url.searchParams.delete(p);
  return url.toString();
}

const outPath = process.argv[2];
if (!outPath) {
  console.error("✗ Geef een uitvoerpad mee: node scripts/export-untranslated.mjs <pad.json> [limit] [offset]");
  process.exit(1);
}
const limit = process.argv[3] ? Number(process.argv[3]) : null;
const offset = process.argv[4] ? Number(process.argv[4]) : 0;

const pool = new Pool({ connectionString: pgConnectionString(), ssl: { rejectUnauthorized: false } });
try {
  const params = [];
  let sql =
    "SELECT id, name, instructions->>'en' AS ins_en, instruction_steps->'en' AS steps_en " +
    "FROM exercise_catalog WHERE NOT (instructions ? 'nl') ORDER BY id";
  if (limit != null) {
    params.push(limit, offset);
    sql += ` LIMIT $1 OFFSET $2`;
  }
  const { rows } = await pool.query(sql, params);
  const out = rows.map((r) => ({
    id: r.id,
    name: r.name,
    ins_en: r.ins_en ?? null,
    steps_en: Array.isArray(r.steps_en) ? r.steps_en : null,
  }));
  await writeFile(outPath, JSON.stringify(out, null, 2), "utf8");

  const remaining = await pool.query(
    "SELECT count(*)::int c FROM exercise_catalog WHERE NOT (instructions ? 'nl')"
  );
  console.log(`Geëxporteerd: ${out.length} records → ${outPath}`);
  console.log(`Nog onvertaald in DB (totaal): ${remaining.rows[0].c}`);
} finally {
  await pool.end();
}
