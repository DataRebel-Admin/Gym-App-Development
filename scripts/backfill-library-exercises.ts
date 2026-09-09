// scripts/backfill-library-exercises.ts
//
// Zet de volledige RepDB-bibliotheek als tenant-Exercise neer bij bestaande
// sportscholen. Nieuwe tenants (superadmin-aanmaak) en de seed doen dit
// automatisch; dit script is voor sportscholen van vóór die regel én als
// snelle "haal alles op" na een dataset-update (`npm run library:import`
// brengt nieuwe slugs, die staan dan nog bij geen enkele tenant).
//
// - Idempotent: al gekoppelde slugs worden overgeslagen; het raakt geen
//   bestaande Exercise-rijen (naam-overrides, machine-koppelingen, schema's).
// - Wat een eigenaar bewust verwijderde komt hiermee WEL terug — vandaar
//   standaard alleen `--tenant=<slug>` óf expliciet `--all`.
// - De aanvullende (klassieke) collectie doet bewust niet mee.
//
// Gebruik:
//   npm run library:backfill -- --tenant=gymrebel
//   npm run library:backfill -- --all [--dry-run] [--no-auto-machine]

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { datasetLocalePreference } from "../lib/exercise-library/mapping";
import { addLibraryExercisesToTenant } from "../lib/exercise-library/tenant-sync";

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const tenantArg = process.argv
  .slice(2)
  .find((a) => a.startsWith("--tenant="))
  ?.slice("--tenant=".length);
const all = args.has("--all");
const dryRun = args.has("--dry-run");
const autoMachine = !args.has("--no-auto-machine");

async function main() {
  if (!tenantArg && !all) {
    console.error("Geef --tenant=<slug> of --all op.");
    process.exit(2);
  }

  const tenants = await prisma.tenant.findMany({
    where: {
      deletedAt: null,
      ...(tenantArg ? { slug: tenantArg } : {}),
    },
    select: { id: true, slug: true, name: true, locale: true },
    orderBy: { slug: "asc" },
  });
  if (tenants.length === 0) {
    console.error(tenantArg ? `Tenant '${tenantArg}' niet gevonden.` : "Geen tenants.");
    process.exit(1);
  }

  const libraryTotal = await prisma.libraryExercise.count({ where: { retiredAt: null } });
  console.log(
    `Bibliotheek: ${libraryTotal} actieve oefeningen. ` +
      `${tenants.length} tenant(s)${dryRun ? " (dry-run)" : ""}, auto-machine ${autoMachine ? "aan" : "uit"}.`
  );

  for (const t of tenants) {
    const owned = await prisma.exercise.count({
      where: { tenantId: t.id, libraryId: { not: null } },
    });
    if (dryRun) {
      console.log(`○ ${t.slug}: ${owned} gekoppeld, ${Math.max(0, libraryTotal - owned)} zou toegevoegd worden`);
      continue;
    }
    const res = await addLibraryExercisesToTenant(prisma, t.id, {
      ids: "all",
      localePref: datasetLocalePreference(t.locale),
      autoMachine,
    });
    console.log(`✓ ${t.slug}: ${res.added} toegevoegd, ${res.skipped} stonden er al`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
