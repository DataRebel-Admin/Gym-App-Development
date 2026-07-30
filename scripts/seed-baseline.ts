import { PrismaClient } from "@prisma/client";
import { SEEDED_SLUGS, writeBaseline, readBaseline } from "../prisma/seed-guard";

/**
 * Zet de nullijn van de seed-bescherming op *nu*, zonder iets te wissen.
 *
 * Betekenis: "wat er nu in de demo-tenants staat is demodata; alles wat ik
 * híérna aanmaak is eigen werk en moet beschermd worden." Nodig op een database
 * die al bestond voordat de bescherming er was (dan is er nog geen markering en
 * valt de guard terug op een schatting). Draaien met: npm run db:seed:baseline
 */
const prisma = new PrismaClient();

const FMT = new Intl.DateTimeFormat("nl-NL", {
  dateStyle: "short",
  timeStyle: "short",
});

async function main() {
  const at = new Date();

  for (const slug of SEEDED_SLUGS) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });
    if (!tenant) {
      console.log(`○ ${slug}: bestaat niet in deze database — overgeslagen`);
      continue;
    }
    const previous = await readBaseline(prisma, slug);
    await writeBaseline(prisma, slug, at);
    console.log(
      `✓ ${tenant.name} (${slug}): nullijn ${previous ? `verzet van ${FMT.format(previous)} ` : "gezet "}naar ${FMT.format(at)}`
    );
  }

  console.log(
    "\nAlles wat je vanaf nu in de app aanmaakt of wijzigt blokkeert een db:seed." +
      "\nControleren kan met: npm run db:seed:check"
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
