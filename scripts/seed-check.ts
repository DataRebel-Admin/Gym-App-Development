import { PrismaClient } from "@prisma/client";
import {
  resolveBaseline,
  findManualData,
  readBaseline,
  SEEDED_SLUGS,
} from "../prisma/seed-guard";

/**
 * Dry-run van de seed-bescherming: laat zien wat een `npm run db:seed` zou
 * tegenhouden (of wissen), zónder ook maar iets te wijzigen. Handig vóór je
 * een reseed overweegt. Draaien met: npm run db:seed:check
 */
const prisma = new PrismaClient();

const FMT = new Intl.DateTimeFormat("nl-NL", {
  dateStyle: "short",
  timeStyle: "short",
});

async function main() {
  let blocked = false;

  for (const slug of SEEDED_SLUGS) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });
    if (!tenant) {
      console.log(`\n○ ${slug}: bestaat niet in deze database`);
      continue;
    }

    const marker = await readBaseline(prisma, slug);
    const baseline = await resolveBaseline(prisma, tenant.id, slug);
    const findings = await findManualData(prisma, tenant.id, baseline ?? new Date(0));

    console.log(`\n── ${tenant.name} (${slug})`);
    console.log(
      `   nullijn: ${baseline ? FMT.format(baseline) : "onbekend"}` +
        (marker ? " (markering)" : " (afgeleid uit oudste gebruiker)")
    );

    if (findings.length === 0) {
      console.log("   ✓ geen eigen data — een db:seed mag deze tenant opnieuw opbouwen");
      continue;
    }
    blocked = true;
    console.log("   ⨯ eigen data gevonden — db:seed wordt geweigerd:");
    for (const f of findings) console.log(`     • ${f.count}× ${f.label}`);
  }

  console.log(
    blocked
      ? "\nResultaat: db:seed wordt GEBLOKKEERD. Overrulen kan met SEED_FORCE=1 (wist de demo-tenants alsnog)."
      : "\nResultaat: db:seed zou doorgaan en de demo-tenants opnieuw opbouwen."
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
