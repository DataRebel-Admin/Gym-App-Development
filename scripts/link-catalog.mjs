// scripts/link-catalog.mjs
//
// Koppelt bestaande tenant-`Exercise`-rijen aan de globale `ExerciseCatalog` op
// basis van een naam-match (case-insensitief). Best-effort en idempotent: alleen
// oefeningen zonder catalogId worden bekeken; al gekoppelde blijven ongemoeid.
//
// Handig om bestaande/geseede data te verrijken zonder de owner-bibliotheek.
// Gebruik: npm run data:link

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const catalog = await prisma.exerciseCatalog.findMany({
    select: { id: true, name: true },
  });
  // name (lowercase) -> catalogId. Bij dubbele namen wint de eerste.
  const byName = new Map();
  for (const c of catalog) {
    const key = c.name.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, c.id);
  }
  console.log(`Catalogus: ${catalog.length} items (${byName.size} unieke namen).`);

  const exercises = await prisma.exercise.findMany({
    where: { catalogId: null },
    select: { id: true, name: true },
  });
  console.log(`Niet-gekoppelde oefeningen: ${exercises.length}`);

  let linked = 0;
  const unmatched = [];
  for (const e of exercises) {
    const catalogId = byName.get(e.name.trim().toLowerCase());
    if (catalogId) {
      await prisma.exercise.update({ where: { id: e.id }, data: { catalogId } });
      linked++;
    } else {
      unmatched.push(e.name);
    }
  }

  console.log(`✓ Gekoppeld: ${linked}`);
  console.log(`• Geen match: ${unmatched.length}`);
  if (unmatched.length > 0) {
    const sample = [...new Set(unmatched)].slice(0, 15);
    console.log(`  voorbeelden: ${sample.join(", ")}`);
  }
}

main()
  .catch((err) => {
    console.error("✗ Koppelen mislukt:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
