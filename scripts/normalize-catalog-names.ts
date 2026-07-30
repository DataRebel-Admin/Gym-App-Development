// scripts/normalize-catalog-names.ts
//
// Normaliseer de weergavenamen van de **aanvullende oefeningen-collectie**
// (`ExerciseCatalog`, de oudere dataset) met `lib/exercise-name.ts`:
//
//   - elk woord met een hoofdletter ("3/4 sit-up" → "3/4 Sit-Up");
//   - het dataset-voorvoegsel `lever` → `Machine` ("lever calf press" →
//     "Machine Calf Press"), nooit in "back lever"/"front lever".
//
// Daarna zet het de **naam-snapshots** van bestaande sportschool-oefeningen om:
// `Exercise.name` is bij het toevoegen gevuld met de catalogusnaam. Alleen rijen
// waar de waarde *letterlijk* de oude catalogusnaam is worden aangeraakt — dat is
// het bewijs dat het de automatische snapshot is en geen handwerk van de
// sportschool (`--skip-snapshots` slaat de stap over). Zelfde patroon als
// `library:lookups`.
//
// Idempotent: een tweede run raakt niets meer aan.
//
// Gebruik:
//   npm run data:names
//   npm run data:names -- --dry-run
//   npm run data:names -- --skip-snapshots

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { formatExerciseName } from "../lib/exercise-name";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");
const skipSnapshots = process.argv.includes("--skip-snapshots");

async function main() {
  console.log(`Namen aanvullende collectie normaliseren${dryRun ? " · DRY-RUN" : ""}`);

  const rows = await prisma.exerciseCatalog.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const changes = rows
    .map((r) => ({ id: r.id, from: r.name, to: formatExerciseName(r.name) }))
    .filter((c) => c.from !== c.to);

  console.log(`\nCatalogus: ${changes.length} van ${rows.length} namen wijzigen.`);
  for (const c of changes.slice(0, 10)) console.log(`  ${c.from}  →  ${c.to}`);
  if (changes.length > 10) console.log(`  … en nog ${changes.length - 10}`);

  // Snapshots eerst matchen op de OUDE naam — daarna pas de catalogus bijwerken.
  const snapshots = skipSnapshots ? [] : await collectSnapshots(changes);

  if (!dryRun) {
    for (const c of changes) {
      await prisma.exerciseCatalog.update({ where: { id: c.id }, data: { name: c.to } });
    }
    for (const s of snapshots) {
      await prisma.exercise.update({ where: { id: s.id }, data: { name: s.to } });
    }
  }

  console.log(
    `\n${dryRun ? "Zou wijzigen" : "✓ Gewijzigd"}: ${changes.length} catalogusnaam/-namen` +
      (skipSnapshots ? " (snapshots overgeslagen)" : `, ${snapshots.length} sportschool-snapshot(s)`)
  );
}

/** Sportschool-oefeningen waarvan de naam nog letterlijk de oude catalogusnaam is. */
async function collectSnapshots(changes: { id: string; from: string; to: string }[]) {
  if (changes.length === 0) return [];
  const byCatalogId = new Map(changes.map((c) => [c.id, c]));

  const linked = await prisma.exercise.findMany({
    where: { catalogId: { in: changes.map((c) => c.id) } },
    select: { id: true, name: true, catalogId: true, tenantId: true },
  });

  const out: { id: string; to: string }[] = [];
  let edited = 0;
  for (const ex of linked) {
    const change = ex.catalogId ? byCatalogId.get(ex.catalogId) : undefined;
    if (!change) continue;
    if (ex.name === change.from) out.push({ id: ex.id, to: change.to });
    else if (ex.name !== change.to) edited++;
  }
  console.log(
    `Snapshots: ${out.length} van ${linked.length} gekoppelde oefening(en) bijwerken` +
      (edited > 0 ? ` (${edited} met een eigen naam blijven ongemoeid)` : "")
  );
  return out;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
