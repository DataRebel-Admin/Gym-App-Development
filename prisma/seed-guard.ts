import type { PrismaClient } from "@prisma/client";

/**
 * Beveiliging vóór de destructieve reset in `seed.ts`.
 *
 * `seedTenant()` wist álle tenant-data (schema's, oefeningen, machines, leden,
 * metingen, defecten, …) om daarna verse demodata te bouwen. Zonder guard eet
 * een `npm run db:seed` dus stilletjes álles op wat je zélf via de app hebt
 * aangemaakt. Deze module weigert dat: hij vergelijkt de tenant met een
 * **baseline** (het moment van de laatste geslaagde seed) en blokkeert zodra er
 * sindsdien iets is bijgekomen of gewijzigd.
 *
 * Provenance per tabel:
 * - De meeste tabellen hebben `createdAt` (en soms `updatedAt`) → exacte
 *   detectie, ook van *bewerkte* seed-data (bv. een aangepast sjabloon).
 * - `Exercise`, `ClassSession`, `WorkoutDay`/`WorkoutExerciseItem` en
 *   `PerformanceEntry` hebben géén eigen tijdstempel. Die worden gedekt door
 *   het **auditlog-vangnet**: élke app-mutatie schrijft een audit-regel en de
 *   seed schrijft er nooit één (zie lib/audit.ts). Puur niet-data-events
 *   (inloggen, mail versturen, exports) staan in de negeerlijst hieronder,
 *   zodat alleen rondklikken de seed niet blokkeert.
 *
 * Overrulen kan bewust met `SEED_FORCE=1 npm run db:seed`.
 */

/** PlatformSetting-key met het tijdstip van de laatste geslaagde seed per tenant. */
export const BASELINE_KEY_PREFIX = "seed.baseline.";

/** Tenants die `seed.ts` opnieuw opbouwt — en dus volledig wist. Eén bron van
 *  waarheid voor de seed zelf én de scripts (db:seed:check / db:seed:baseline). */
export const SEEDED_SLUGS = ["gymrebel", "ironhouse"] as const;

/**
 * Marge voor een *impliciete* baseline (nog geen markering in de database, bv.
 * een tenant die met een oudere seed-versie is gevuld). De oudste gebruiker van
 * een tenant is per definitie door de seed gemaakt — die wist immers eerst álle
 * gebruikers — dus het begin van die seed-run. De rest van de run (schema's,
 * sessies, trofeeën) volgt binnen seconden; deze marge vangt dat ruim af.
 */
const IMPLICIT_MARGIN_MS = 15 * 60 * 1000;

/** Audit-acties die géén beschermenswaardige tenant-data betekenen. */
const IGNORED_AUDIT_PREFIXES = ["auth.", "report.", "support.", "privacy."];
const IGNORED_AUDIT_SUFFIXES = [".notify.sent", ".email.sent"];
const IGNORED_AUDIT_ACTIONS = [
  "machine.qr.export",
  "user.activate.opened",
  "user.activate.expired",
];

export type ManualFinding = { label: string; count: number };

export function baselineKey(slug: string): string {
  return `${BASELINE_KEY_PREFIX}${slug}`;
}

/** Leest de baseline-markering; `null` als die er (nog) niet is. */
export async function readBaseline(
  prisma: PrismaClient,
  slug: string
): Promise<Date | null> {
  const row = await prisma.platformSetting.findUnique({
    where: { key: baselineKey(slug) },
  });
  if (!row?.value) return null;
  const at = new Date(row.value);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** Legt vast dat de seed zojuist geslaagd is (alles daarna telt als eigen werk). */
export async function writeBaseline(
  prisma: PrismaClient,
  slug: string,
  at: Date = new Date()
): Promise<void> {
  const value = at.toISOString();
  await prisma.platformSetting.upsert({
    where: { key: baselineKey(slug) },
    update: { value, updatedByEmail: "db:seed" },
    create: { key: baselineKey(slug), value, updatedByEmail: "db:seed" },
  });
}

/**
 * Vanaf welk moment telt data als "zelf aangemaakt"? Markering wint; anders
 * afgeleid uit de oudste (dus door de seed gemaakte) gebruiker + marge.
 * `null` = onbekend → de caller behandelt alle data als eigen werk.
 */
export async function resolveBaseline(
  prisma: PrismaClient,
  tenantId: string,
  slug: string
): Promise<Date | null> {
  const marker = await readBaseline(prisma, slug);
  if (marker) return marker;

  const oldest = await prisma.user.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  if (!oldest) return null;
  return new Date(oldest.createdAt.getTime() + IMPLICIT_MARGIN_MS);
}

/** Alles wat ná `since` is aangemaakt of gewijzigd, gegroepeerd per soort. */
export async function findManualData(
  prisma: PrismaClient,
  tenantId: string,
  since: Date
): Promise<ManualFinding[]> {
  const gt = { gt: since };

  const probes: { label: string; count: Promise<number> }[] = [
    {
      label: "schema-sjablonen (nieuw of bewerkt)",
      count: prisma.workoutTemplate.count({
        where: { tenantId, isLibrary: true, OR: [{ createdAt: gt }, { updatedAt: gt }] },
      }),
    },
    {
      // Onafhankelijk van tijdstempels: deze velden zet uitsluitend de app
      // (app/owner/schemas/actions.ts), nooit de seed zelf.
      label: "handmatig toegewezen of zelfgebouwde lid-schema's",
      count: prisma.assignedWorkout.count({
        where: {
          tenantId,
          OR: [{ assignedById: { not: null } }, { origin: "MEMBER" }, { createdAt: gt }],
        },
      }),
    },
    {
      label: "apparaten",
      count: prisma.machine.count({ where: { tenantId, createdAt: gt } }),
    },
    {
      label: "gebruikers (leden of medewerkers)",
      count: prisma.user.count({ where: { tenantId, createdAt: gt } }),
    },
    {
      label: "vestigingen (nieuw of bewerkt)",
      count: prisma.location.count({
        where: { tenantId, OR: [{ createdAt: gt }, { updatedAt: gt }] },
      }),
    },
    {
      label: "medewerker-vestigingkoppelingen",
      count: prisma.staffLocationAccess.count({ where: { tenantId, createdAt: gt } }),
    },
    {
      label: "coach↔lid-koppelingen",
      count: prisma.coachAssignment.count({ where: { tenantId, createdAt: gt } }),
    },
    {
      label: "coachnotities (nieuw of bewerkt)",
      count: prisma.coachNote.count({
        where: { tenantId, OR: [{ createdAt: gt }, { updatedAt: gt }] },
      }),
    },
    {
      label: "metingen (nieuw of bewerkt)",
      count: prisma.measurement.count({
        where: { tenantId, OR: [{ createdAt: gt }, { updatedAt: gt }] },
      }),
    },
    {
      label: "voortgangsfoto's",
      count: prisma.measurementPhoto.count({ where: { tenantId, createdAt: gt } }),
    },
    {
      label: "doelen",
      count: prisma.memberGoal.count({ where: { tenantId, createdAt: gt } }),
    },
    {
      label: "schema-kaders (nieuw of bewerkt)",
      count: prisma.schemaFramework.count({
        where: { tenantId, OR: [{ createdAt: gt }, { updatedAt: gt }] },
      }),
    },
    {
      label: "kader-koppelingen",
      count: prisma.memberFrameworkAssignment.count({ where: { tenantId, createdAt: gt } }),
    },
    {
      label: "onderhoudsregistraties",
      count: prisma.maintenanceRecord.count({ where: { tenantId, createdAt: gt } }),
    },
    {
      label: "onderhoudsbeleid (nieuw of bewerkt)",
      count: prisma.maintenancePolicy.count({
        where: { tenantId, OR: [{ createdAt: gt }, { updatedAt: gt }] },
      }),
    },
    {
      label: "apparaatdefecten (nieuw of bijgewerkt)",
      count: prisma.equipmentDefect.count({
        where: { tenantId, OR: [{ createdAt: gt }, { updatedAt: gt }] },
      }),
    },
    {
      label: "defect-bevestigingen",
      count: prisma.defectConfirmation.count({ where: { tenantId, createdAt: gt } }),
    },
    {
      label: "groepslessen",
      count: prisma.groupClass.count({ where: { tenantId, createdAt: gt } }),
    },
    {
      label: "les-aanmeldingen",
      count: prisma.classEnrollment.count({ where: { tenantId, enrolledAt: gt } }),
    },
    {
      // Bewust `createdAt` en niet `startedAt`: de seed dateert sessies terug én
      // genereert voor vandaag willekeurige tijdstippen die ná de seedrun kunnen
      // liggen (zie migratie 20260730130000_workout_session_created_at).
      label: "trainingssessies",
      count: prisma.workoutSession.count({ where: { tenantId, createdAt: gt } }),
    },
    {
      // Vangnet voor tabellen zonder eigen tijdstempel (eigen oefeningen,
      // lessessies, bewerkte schema-dagen/-oefeningen).
      label: "app-acties in het auditlog (o.a. oefeningen, lessen, bewerkingen)",
      count: prisma.auditLog.count({
        where: {
          tenantId,
          createdAt: gt,
          NOT: [
            ...IGNORED_AUDIT_PREFIXES.map((p) => ({ action: { startsWith: p } })),
            ...IGNORED_AUDIT_SUFFIXES.map((s) => ({ action: { endsWith: s } })),
            { action: { in: IGNORED_AUDIT_ACTIONS } },
          ],
        },
      }),
    },
  ];

  const counts = await Promise.all(probes.map((p) => p.count));
  return probes
    .map((p, i) => ({ label: p.label, count: counts[i] }))
    .filter((f) => f.count > 0);
}

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", {
  dateStyle: "short",
  timeStyle: "short",
});

function refusalMessage(
  tenantLabel: string,
  baseline: Date | null,
  findings: ManualFinding[]
): string {
  const sinceText = baseline
    ? `sinds de laatste seed (${DATE_FMT.format(baseline)})`
    : "in deze database (geen seed-markering gevonden)";
  const list = findings.map((f) => `    • ${f.count}× ${f.label}`).join("\n");
  return (
    `Seed geweigerd: tenant "${tenantLabel}" bevat eigen data die ${sinceText} via ` +
    `de app is aangemaakt of gewijzigd:\n${list}\n\n` +
    `  Een db:seed wist de hele tenant en zou dit onherstelbaar verwijderen. Opties:\n` +
    `    • Werk verder in een eigen tenant (die raakt de seed nooit aan), of\n` +
    `    • SEED_FORCE=1 npm run db:seed  → demo-tenants alsnog opnieuw opbouwen, of\n` +
    `    • npm run db:reset              → volledig schone database + verse seed`
  );
}

/**
 * Blokkeert de reset als er sinds de laatste seed eigen data is bijgekomen of
 * gewijzigd. Gooit met een lijst van wat er in de weg staat.
 */
export async function assertTenantUnchanged(
  prisma: PrismaClient,
  tenantId: string,
  slug: string,
  tenantLabel: string
): Promise<void> {
  if (process.env.SEED_FORCE === "1") return;
  const baseline = await resolveBaseline(prisma, tenantId, slug);
  const findings = await findManualData(prisma, tenantId, baseline ?? new Date(0));
  if (findings.length === 0) return;
  throw new Error(refusalMessage(tenantLabel, baseline, findings));
}

/**
 * De seed vervangt óók de superadmin(s). Weigert als er een andere superadmin
 * bestaat dan het demo-account — dat is per definitie handmatig aangemaakt.
 */
export async function assertNoExtraSuperadmins(
  prisma: PrismaClient,
  demoEmail: string
): Promise<void> {
  if (process.env.SEED_FORCE === "1") return;
  const extra = await prisma.user.findMany({
    where: { role: "SUPERADMIN", email: { not: demoEmail } },
    select: { email: true },
    take: 10,
  });
  if (extra.length === 0) return;
  const list = extra.map((u) => `    • ${u.email ?? "(geen e-mail)"}`).join("\n");
  throw new Error(
    `Seed geweigerd: er bestaan superadmin-accounts naast het demo-account ` +
      `(${demoEmail}) die de seed zou verwijderen:\n${list}\n\n` +
      `  Verwijder ze zelf of gebruik SEED_FORCE=1 als dit demodata is.`
  );
}
