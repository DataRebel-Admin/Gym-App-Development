// scripts/apply-nl.mjs
//
// Backfill-hulp (eenmalig): schrijf in-sessie gemaakte nl-vertalingen terug in
// exercise_catalog. Idempotent: zet instructions.nl (en instruction_steps.nl waar
// stappen bestaan) via jsonb_set, overschrijft een eventuele bestaande nl.
//
// Invoer = JSON-array: [{ id, ins_nl?, steps_nl? }]
//   - steps_nl: string[] (de vertaalde stappen; toegepast als de rij en-stappen heeft)
//   - ins_nl:   string (de vertaalde paragraaf). Optioneel als steps_nl gegeven is:
//               dan wordt ins_nl afgeleid als steps_nl.join(" ") (de bron-en is óók
//               de stappen aaneengeregen). Eén van beide is verplicht.
//
// Gebruik: node scripts/apply-nl.mjs <pad.json>

import "dotenv/config";
import { readFile } from "node:fs/promises";
import pg from "pg";

const { Pool } = pg;

function pgConnectionString() {
  const url = new URL(process.env.DATABASE_URL);
  for (const p of ["schema", "channel_binding", "sslmode"]) url.searchParams.delete(p);
  return url.toString();
}

const inPath = process.argv[2];
if (!inPath) {
  console.error("✗ Geef een invoerpad mee: node scripts/apply-nl.mjs <pad.json>");
  process.exit(1);
}

const entries = JSON.parse(await readFile(inPath, "utf8"));
if (!Array.isArray(entries)) {
  console.error("✗ Invoer moet een JSON-array zijn.");
  process.exit(1);
}

const pool = new Pool({ connectionString: pgConnectionString(), ssl: { rejectUnauthorized: false } });
let updated = 0;
const skipped = [];
try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const e of entries) {
      const steps = Array.isArray(e?.steps_nl) ? e.steps_nl.map((s) => String(s)) : null;
      // ins_nl expliciet, anders afgeleid uit de stappen (bron-en = stappen aaneengeregen).
      const insNl =
        typeof e?.ins_nl === "string" && e.ins_nl.trim() !== ""
          ? e.ins_nl
          : steps && steps.length > 0
            ? steps.join(" ")
            : null;
      if (!e || typeof e.id !== "string" || !insNl) {
        skipped.push(e?.id ?? "(geen id)");
        continue;
      }
      // instructions.nl altijd zetten.
      await client.query(
        `UPDATE exercise_catalog
           SET instructions = jsonb_set(COALESCE(instructions, '{}'::jsonb), '{nl}', to_jsonb($2::text), true)
         WHERE id = $1`,
        [e.id, insNl]
      );
      // instruction_steps.nl alleen als er stappen meegegeven zijn én de rij en-stappen heeft.
      if (steps && steps.length > 0) {
        await client.query(
          `UPDATE exercise_catalog
             SET instruction_steps = jsonb_set(instruction_steps, '{nl}', $2::jsonb, true)
           WHERE id = $1 AND instruction_steps ? 'en'`,
          [e.id, JSON.stringify(steps)]
        );
      }
      updated++;
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  const total = await pool.query("SELECT count(*)::int c FROM exercise_catalog");
  const withNl = await pool.query("SELECT count(*)::int c FROM exercise_catalog WHERE instructions ? 'nl'");
  console.log(`Toegepast: ${updated} | overgeslagen: ${skipped.length}${skipped.length ? " (" + skipped.join(", ") + ")" : ""}`);
  console.log(`Stand: ${withNl.rows[0].c}/${total.rows[0].c} met nl`);

  // Vangnet: nl-stappen moeten evenveel items hebben als en-stappen.
  const mism = await pool.query(
    `SELECT id, jsonb_array_length(instruction_steps->'en') AS en, jsonb_array_length(instruction_steps->'nl') AS nl
       FROM exercise_catalog
      WHERE instruction_steps ? 'en' AND instruction_steps ? 'nl'
        AND jsonb_array_length(instruction_steps->'en') <> jsonb_array_length(instruction_steps->'nl')
      ORDER BY id`
  );
  if (mism.rows.length > 0) {
    console.log(`⚠ Stap-aantal mismatch in ${mism.rows.length} record(s):`);
    for (const r of mism.rows) console.log(`   ${r.id}: en=${r.en} nl=${r.nl}`);
  }
} finally {
  await pool.end();
}
