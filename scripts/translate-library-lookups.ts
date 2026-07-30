// scripts/translate-library-lookups.ts
//
// Schrijf de handmatig gecureerde Nederlandse namen uit
// `lib/translate/library-lookups-nl.ts` naar de twee bibliotheek-lookups
// (`LibraryMuscle.names.nl` en `LibraryEquipment.names.nl`).
//
// - **Geen API-calls**: dit is curatie, geen machinevertaling (102 termen).
// - **Idempotent**: rijen die de naam al hebben worden overgeslagen.
// - **Merge, geen overschrijving**: de en/de/es-namen uit de RepDB-bundel blijven.
// - **Luid over gaten**: een slug in de database zónder curatie (bv. na een
//   dataset-update met nieuw materiaal) wordt opgesomd en levert exitcode 1, zodat
//   het niet stil Engels blijft.
//
// Daarna zet het de **spier-snapshots** van bestaande sportschool-oefeningen om:
// `Exercise.targetMuscle` is bij het toevoegen gevuld met de Engelse lookup-naam.
// Alleen rijen waar de waarde *letterlijk* de Engelse naam is worden aangeraakt —
// dat is het bewijs dat het de automatische snapshot is en geen handwerk van de
// sportschool (`--skip-snapshots` slaat de stap over).
//
// Gebruik:
//   npm run library:lookups            (wegschrijven)
//   npm run library:lookups -- --dry-run
//   npm run library:lookups -- --skip-snapshots
//
// N.B. `library:import` bewaart een bestaande nl-naam bij een re-import, dus de
// twee scripts kunnen in elke volgorde draaien.

import "dotenv/config";
import { PrismaClient, type Prisma } from "@prisma/client";
import {
  MUSCLE_NL,
  EQUIPMENT_NL,
  withDutchName,
  hasDutchName,
} from "../lib/translate/library-lookups-nl";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");
const skipSnapshots = process.argv.includes("--skip-snapshots");

/** Naam in één taal uit een `names`-Json (null als afwezig/onbruikbaar). */
function nameIn(names: Prisma.JsonValue | undefined, locale: string): string | null {
  if (!names || typeof names !== "object" || Array.isArray(names)) return null;
  const value = (names as Record<string, unknown>)[locale];
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Zet `Exercise.targetMuscle` van bibliotheek-oefeningen om naar de Nederlandse
 * spiernaam — uitsluitend waar de huidige waarde exact de Engelse lookup-naam is.
 * Een sportschool die zelf een spier heeft ingevuld houdt dus haar eigen tekst.
 */
async function migrateSnapshots(): Promise<void> {
  const muscles = await prisma.libraryMuscle.findMany({ select: { id: true, names: true } });
  const byId = new Map(muscles.map((m) => [m.id, m.names]));

  const rows = await prisma.exercise.findMany({
    where: { libraryId: { not: null }, targetMuscle: { not: null } },
    select: { id: true, targetMuscle: true, library: { select: { primaryMuscles: true } } },
  });

  let changed = 0;
  let kept = 0;
  for (const row of rows) {
    const slug = row.library?.primaryMuscles[0];
    if (!slug) continue;
    const names = byId.get(slug);
    const en = nameIn(names, "en");
    const nl = nameIn(names, "nl");
    if (!en || !nl || nl === en) continue;
    if (row.targetMuscle !== en) {
      kept++; // eigen tekst of al Nederlands → afblijven
      continue;
    }
    if (!dryRun) {
      await prisma.exercise.update({ where: { id: row.id }, data: { targetMuscle: nl } });
    }
    changed++;
  }
  console.log(
    `Spier-snapshots: ${changed} ${dryRun ? "zou omzetten" : "omgezet"} · ` +
      `${kept} ongemoeid (eigen tekst of al NL) · ${rows.length} bekeken`
  );
}

type Row = { id: string; names: Prisma.JsonValue };

/** Eén lookup-tabel bijwerken; levert de slugs zonder curatie terug. */
async function applyTo(
  label: string,
  rows: Row[],
  curated: Record<string, string>,
  update: (id: string, names: Record<string, string>) => Promise<unknown>
): Promise<string[]> {
  const missing: string[] = [];
  let written = 0;
  let alreadyDone = 0;

  for (const row of rows) {
    const nl = curated[row.id];
    if (!nl) {
      missing.push(row.id);
      continue;
    }
    if (hasDutchName(row.names, nl)) {
      alreadyDone++;
      continue;
    }
    if (!dryRun) await update(row.id, withDutchName(row.names, nl));
    written++;
  }

  console.log(
    `${label}: ${written} ${dryRun ? "zou bijwerken" : "bijgewerkt"} · ` +
      `${alreadyDone} al gedaan · ${rows.length} totaal`
  );
  const unused = Object.keys(curated).filter((slug) => !rows.some((r) => r.id === slug));
  if (unused.length > 0) {
    console.log(`  (${unused.length} gecureerde slug(s) niet in de database: ${unused.join(", ")})`);
  }
  return missing;
}

async function main() {
  console.log(`Nederlandse lookup-namen wegschrijven${dryRun ? " · DRY-RUN" : ""}`);

  const [muscles, equipment] = await Promise.all([
    prisma.libraryMuscle.findMany({ select: { id: true, names: true }, orderBy: { id: "asc" } }),
    prisma.libraryEquipment.findMany({
      select: { id: true, names: true },
      orderBy: { id: "asc" },
    }),
  ]);

  const missingMuscles = await applyTo("Spieren", muscles, MUSCLE_NL, (id, names) =>
    prisma.libraryMuscle.update({ where: { id }, data: { names } })
  );
  const missingEquipment = await applyTo("Materiaal", equipment, EQUIPMENT_NL, (id, names) =>
    prisma.libraryEquipment.update({ where: { id }, data: { names } })
  );

  if (!skipSnapshots) await migrateSnapshots();

  if (missingMuscles.length > 0 || missingEquipment.length > 0) {
    console.error(
      `\n✗ Zonder Nederlandse naam — vul aan in lib/translate/library-lookups-nl.ts:` +
        (missingMuscles.length ? `\n  spieren:   ${missingMuscles.join(", ")}` : "") +
        (missingEquipment.length ? `\n  materiaal: ${missingEquipment.join(", ")}` : "")
    );
    process.exitCode = 1;
    return;
  }
  console.log("\n✓ Alle spier- en materiaalnamen hebben een Nederlandse variant.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
