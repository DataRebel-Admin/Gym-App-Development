/**
 * Herstelt de vestigingen-invariant: élke tenant heeft minstens één actieve
 * vestiging, waarvan er precies één default is (idempotent).
 *
 * Achtergrond: de locations-migratie (20260728120000) backfillde alleen de
 * tóén bestaande tenants met een "Hoofdvestiging". Tenants die daarna via het
 * superadmin-paneel zijn aangemaakt vóór de fix in app/admin/tenants/actions.ts
 * hebben géén vestiging — waardoor machines aanmaken, sessies starten en het
 * rooster kapot gaan (locationId is verplicht).
 *
 * Per tenant:
 *  - geen actieve vestiging → gearchiveerde "Hoofdvestiging" heractiveren als
 *    default, anders een nieuwe "Hoofdvestiging" aanmaken (adres gekopieerd van
 *    de tenant, zoals de migratie-backfill);
 *  - wel actieve vestigingen maar geen default → oudste actieve wordt default.
 *
 * Lokaal: `npm run db:heal-locations`
 * Productie: eenmalig draaien na de deploy van deze fix (zoals db:rls).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      slug: true,
      addressLine: true,
      postalCode: true,
      city: true,
      country: true,
      contactPhone: true,
      contactEmail: true,
      openingHours: true,
      locations: {
        select: { id: true, name: true, isDefault: true, archivedAt: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  let healed = 0;
  for (const t of tenants) {
    const active = t.locations.filter((l) => l.archivedAt === null);

    if (active.length === 0) {
      const archivedHoofd = t.locations.find((l) => l.name === "Hoofdvestiging");
      if (archivedHoofd) {
        await prisma.location.update({
          where: { id: archivedHoofd.id },
          data: { archivedAt: null, isDefault: true },
        });
        console.log(`✓ ${t.slug}: gearchiveerde Hoofdvestiging geheractiveerd als default`);
      } else {
        await prisma.location.create({
          data: {
            tenantId: t.id,
            name: "Hoofdvestiging",
            isDefault: true,
            addressLine: t.addressLine,
            postalCode: t.postalCode,
            city: t.city,
            country: t.country,
            contactPhone: t.contactPhone,
            contactEmail: t.contactEmail,
            openingHours: t.openingHours ?? undefined,
          },
        });
        console.log(`✓ ${t.slug}: Hoofdvestiging aangemaakt`);
      }
      healed++;
    } else if (!active.some((l) => l.isDefault)) {
      await prisma.location.update({
        where: { id: active[0].id },
        data: { isDefault: true },
      });
      console.log(`✓ ${t.slug}: "${active[0].name}" gepromoveerd tot default`);
      healed++;
    }
  }

  console.log(
    healed === 0
      ? `Alle ${tenants.length} tenants zijn al in orde. Klaar.`
      : `Klaar: ${healed} van ${tenants.length} tenants hersteld.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
