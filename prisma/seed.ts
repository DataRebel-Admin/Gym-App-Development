import { PrismaClient, MachineType, Role, Locale } from "@prisma/client";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

/** Genereer een random 16-karakter qrToken (hex). */
function qrToken(): string {
  return randomBytes(8).toString("hex"); // 16 hex-chars
}

type ExerciseSpec = {
  name: string;
  targetMuscle: string;
  machine: string | null; // machine-naam binnen dezelfde tenant, of null (lichaamsgewicht)
  catalogName?: string; // exacte naam in ExerciseCatalog (lowercase) → koppelt media/instructies
};

type TemplateSpec = {
  name: string;
  description: string;
  items: { exercise: string; sets: number; reps: number; restSeconds: number }[];
};

type TenantSpec = {
  slug: string;
  name: string;
  accentColor: string;
  locale: Locale;
  aiEnabled?: boolean;
  owner: { email: string; name: string };
  members: { email: string; name: string }[];
  machines: { name: string; type: MachineType; description: string }[];
  exercises: ExerciseSpec[];
  templates: TemplateSpec[];
};

async function seedTenant(spec: TenantSpec) {
  const tenant = await prisma.tenant.upsert({
    where: { slug: spec.slug },
    update: { name: spec.name, accentColor: spec.accentColor, locale: spec.locale },
    create: {
      slug: spec.slug,
      name: spec.name,
      accentColor: spec.accentColor,
      locale: spec.locale,
      aiEnabled: spec.aiEnabled ?? false,
    },
  });

  // Idempotent: ruim bestaande child-data op in FK-volgorde.
  await prisma.classEnrollment.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.classSession.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.groupClass.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.aiUsage.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.performanceEntry.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.workoutSession.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.assignedWorkout.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.workoutExerciseItem.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.workoutTemplate.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.exercise.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.machine.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.user.deleteMany({ where: { tenantId: tenant.id } });

  // Gebruikers.
  await prisma.user.create({
    data: { tenantId: tenant.id, role: Role.TENANT_ADMIN, ...spec.owner },
  });
  await Promise.all(
    spec.members.map((m) =>
      prisma.user.create({ data: { tenantId: tenant.id, role: Role.TENANT_MEMBER, ...m } })
    )
  );

  // Machines.
  const machines = await Promise.all(
    spec.machines.map((m) =>
      prisma.machine.create({
        data: {
          tenantId: tenant.id,
          name: m.name,
          type: m.type,
          description: m.description,
          instructionsMd: `## ${m.name}\n\n1. Stel de machine af op jouw lengte.\n2. Voer de beweging rustig en gecontroleerd uit.\n3. Adem uit bij inspanning.`,
          qrToken: qrToken(),
        },
      })
    )
  );
  const machineByName = new Map(machines.map((m) => [m.name, m]));

  // Koppel-namen → catalogId (één query). Verrijkt de seed-oefeningen met
  // catalogus-media/instructies zonder de NL-namen te verliezen.
  const wantedCatalog = spec.exercises
    .map((e) => e.catalogName)
    .filter((n): n is string => Boolean(n));
  const catalogItems =
    wantedCatalog.length > 0
      ? await prisma.exerciseCatalog.findMany({
          where: { name: { in: wantedCatalog } },
          select: { id: true, name: true },
        })
      : [];
  const catalogIdByName = new Map(
    catalogItems.map((c) => [c.name.toLowerCase(), c.id])
  );

  // Oefeningen.
  const exercises = await Promise.all(
    spec.exercises.map((e) =>
      prisma.exercise.create({
        data: {
          tenantId: tenant.id,
          name: e.name,
          targetMuscle: e.targetMuscle,
          machineId: e.machine ? machineByName.get(e.machine)?.id ?? null : null,
          catalogId: e.catalogName
            ? catalogIdByName.get(e.catalogName.toLowerCase()) ?? null
            : null,
          description: `${e.name} — gericht op ${e.targetMuscle.toLowerCase()}.`,
        },
      })
    )
  );
  const exerciseByName = new Map(exercises.map((e) => [e.name, e]));

  // Library-templates met oefeningen.
  for (const tpl of spec.templates) {
    await prisma.workoutTemplate.create({
      data: {
        tenantId: tenant.id,
        name: tpl.name,
        description: tpl.description,
        isLibrary: true,
        items: {
          create: tpl.items.map((it, idx) => {
            const ex = exerciseByName.get(it.exercise);
            if (!ex) throw new Error(`Oefening niet gevonden: ${it.exercise}`);
            return {
              tenantId: tenant.id,
              exerciseId: ex.id,
              order: idx,
              sets: it.sets,
              reps: it.reps,
              restSeconds: it.restSeconds,
            };
          }),
        },
      },
    });
  }

  console.log(
    `✓ ${spec.name} (${spec.slug}): 1 owner, ${spec.members.length} members, ` +
      `${machines.length} machines, ${exercises.length} oefeningen, ${spec.templates.length} templates.`
  );
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length > 0) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

/**
 * Genereer trainingsactiviteit (WorkoutSessions + PerformanceEntries) over de
 * laatste `days` dagen, zodat het owner-dashboard zinvolle cijfers toont.
 */
async function seedActivity(
  slug: string,
  opts: { days: number; trainProbability: number }
) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug } });
  const members = await prisma.user.findMany({
    where: { tenantId: tenant.id, role: "TENANT_MEMBER" },
  });
  const exercises = await prisma.exercise.findMany({
    where: { tenantId: tenant.id },
  });
  if (members.length === 0 || exercises.length === 0) return;

  const now = new Date();
  let sessions = 0;
  let entries = 0;

  for (let d = 0; d < opts.days; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() - d);
    for (const member of members) {
      if (Math.random() > opts.trainProbability) continue;

      const startedAt = new Date(day);
      startedAt.setHours(
        8 + Math.floor(Math.random() * 12),
        Math.floor(Math.random() * 60),
        0,
        0
      );
      const endedAt = new Date(startedAt.getTime() + (30 + Math.random() * 40) * 60000);

      const session = await prisma.workoutSession.create({
        data: { tenantId: tenant.id, userId: member.id, startedAt, endedAt },
      });
      sessions++;

      const picks = pickRandom(exercises, 3 + Math.floor(Math.random() * 3));
      const rows = picks.flatMap((ex) => {
        const baseWeight = ex.machineId ? 20 + Math.random() * 40 : 0;
        return Array.from({ length: 3 }, (_, i) => ({
          tenantId: tenant.id,
          sessionId: session.id,
          exerciseId: ex.id,
          setNumber: i + 1,
          reps: 8 + Math.floor(Math.random() * 8),
          weightKg: Math.round(baseWeight),
        }));
      });
      await prisma.performanceEntry.createMany({ data: rows });
      entries += rows.length;
    }
  }
  console.log(`  ↳ activiteit ${slug}: ${sessions} sessies, ${entries} entries`);
}

/** Wijs een lid een (gekloond, lid-specifiek) schema toe op basis van een template. */
async function seedAssignment(
  slug: string,
  memberEmail: string,
  templateName: string
) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug } });
  const member = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: memberEmail, role: "TENANT_MEMBER" },
  });
  const source = await prisma.workoutTemplate.findFirst({
    where: { tenantId: tenant.id, isLibrary: true, name: templateName },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!member || !source) return;

  await prisma.workoutTemplate.create({
    data: {
      tenantId: tenant.id,
      name: source.name,
      description: source.description,
      isLibrary: false,
      assignedWorkouts: { create: { tenantId: tenant.id, userId: member.id } },
      items: {
        create: source.items.map((it) => ({
          tenantId: tenant.id,
          exerciseId: it.exerciseId,
          order: it.order,
          sets: it.sets,
          reps: it.reps,
          restSeconds: it.restSeconds,
        })),
      },
    },
  });
  console.log(`  ↳ schema toegewezen: ${memberEmail} ← ${templateName}`);
}

function futureDate(daysAhead: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** Groepslessen + sessies; vult één les vol om de capaciteit te demonstreren. */
async function seedRooster(slug: string) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug } });
  const lisa = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: "lisa@fitpower.nl", role: "TENANT_MEMBER" },
  });

  // Spinning — max 1, en meteen vol (Lisa aangemeld) om "vol" te tonen.
  const spinning = await prisma.groupClass.create({
    data: {
      tenantId: tenant.id,
      name: "Spinning",
      instructorName: "Eva",
      maxParticipants: 1,
      sessions: {
        create: [
          {
            tenantId: tenant.id,
            startsAt: futureDate(1, 18),
            endsAt: futureDate(1, 19),
            location: "Zaal 1",
          },
        ],
      },
    },
    include: { sessions: true },
  });
  if (lisa) {
    await prisma.classEnrollment.create({
      data: {
        tenantId: tenant.id,
        sessionId: spinning.sessions[0].id,
        userId: lisa.id,
      },
    });
  }

  // Yoga — ruime capaciteit, twee sessies.
  await prisma.groupClass.create({
    data: {
      tenantId: tenant.id,
      name: "Yoga",
      instructorName: "Noa",
      maxParticipants: 12,
      sessions: {
        create: [
          { tenantId: tenant.id, startsAt: futureDate(2, 9), endsAt: futureDate(2, 10), location: "Studio" },
          { tenantId: tenant.id, startsAt: futureDate(4, 19), endsAt: futureDate(4, 20), location: "Studio" },
        ],
      },
    },
  });

  console.log(`  ↳ rooster ${slug}: 2 lessen, 3 sessies (Spinning is vol)`);
}

async function main() {
  // SUPERADMIN — platform-beheerder, geen tenant (transcendeert tenants).
  await prisma.user.deleteMany({ where: { role: Role.SUPERADMIN } });
  await prisma.user.create({
    data: {
      email: "superadmin@gymrebel.app",
      name: "Platform Beheer",
      role: Role.SUPERADMIN,
      tenantId: null,
    },
  });
  console.log("✓ superadmin@gymrebel.app (geen tenant)");

  // Tenant 1 — rijke demo.
  await seedTenant({
    slug: "fitpower",
    name: "FitPower Leeuwarden",
    accentColor: "#E84B1F",
    locale: Locale.NL,
    owner: { email: "owner@fitpower.nl", name: "Bea Eigenaar" },
    members: [
      { email: "sven@fitpower.nl", name: "Sven Sporter" },
      { email: "lisa@fitpower.nl", name: "Lisa Lifter" },
      { email: "tom@fitpower.nl", name: "Tom Trainer" },
    ],
    machines: [
      { name: "Loopband", type: MachineType.CARDIO, description: "Hardlopen en wandelen op snelheid." },
      { name: "Crosstrainer", type: MachineType.CARDIO, description: "Low-impact cardio voor het hele lichaam." },
      { name: "Beenpers", type: MachineType.KRACHT, description: "Krachttraining voor de benen." },
      { name: "Lat pulldown", type: MachineType.KRACHT, description: "Trekoefening voor de rug." },
      { name: "Halterbank", type: MachineType.VRIJE_GEWICHTEN, description: "Verstelbare bank voor halteroefeningen." },
    ],
    exercises: [
      { name: "Hardlopen", targetMuscle: "Cardio", machine: "Loopband" },
      { name: "Crosstrainen", targetMuscle: "Cardio", machine: "Crosstrainer" },
      { name: "Beenpers", targetMuscle: "Quadriceps", machine: "Beenpers", catalogName: "lever alternate leg press" },
      { name: "Lat pulldown", targetMuscle: "Latissimus", machine: "Lat pulldown", catalogName: "cable lat pulldown full range of motion" },
      { name: "Bankdrukken", targetMuscle: "Borst", machine: "Halterbank", catalogName: "barbell bench press" },
      { name: "Biceps curl", targetMuscle: "Biceps", machine: "Halterbank", catalogName: "dumbbell biceps curl" },
      { name: "Squat", targetMuscle: "Benen", machine: null, catalogName: "dumbbell squat" },
      { name: "Push-up", targetMuscle: "Borst", machine: null, catalogName: "push-up" },
      { name: "Plank", targetMuscle: "Core", machine: null, catalogName: "front plank with twist" },
      { name: "Lunges", targetMuscle: "Benen", machine: null, catalogName: "dumbbell lunge" },
    ],
    templates: [
      {
        name: "Full Body Start",
        description: "Rustige start voor het hele lichaam.",
        items: [
          { exercise: "Beenpers", sets: 3, reps: 12, restSeconds: 60 },
          { exercise: "Lat pulldown", sets: 3, reps: 10, restSeconds: 60 },
          { exercise: "Bankdrukken", sets: 3, reps: 10, restSeconds: 75 },
          { exercise: "Plank", sets: 3, reps: 30, restSeconds: 45 },
        ],
      },
      {
        name: "Cardio + Core",
        description: "Conditie en buikspieren.",
        items: [
          { exercise: "Hardlopen", sets: 1, reps: 20, restSeconds: 0 },
          { exercise: "Crosstrainen", sets: 1, reps: 15, restSeconds: 0 },
          { exercise: "Squat", sets: 3, reps: 15, restSeconds: 45 },
          { exercise: "Plank", sets: 3, reps: 40, restSeconds: 45 },
        ],
      },
    ],
  });

  // Tenant 2 — compacte tweede sportschool (verifieert isolatie + theming).
  await seedTenant({
    slug: "ironhouse",
    name: "IronHouse Amsterdam",
    accentColor: "#2563EB", // blauw i.p.v. oranje
    locale: Locale.EN,
    owner: { email: "owner@ironhouse.nl", name: "Ivo IJzer" },
    // Bewust hetzelfde e-mailadres als een FitPower-lid: dezelfde persoon kan
    // bij meerdere sportscholen sporten (e-mail is uniek *per tenant*).
    members: [{ email: "sven@fitpower.nl", name: "Sven (IronHouse)" }],
    machines: [
      { name: "Rowing machine", type: MachineType.CARDIO, description: "Full-body cardio rower." },
      { name: "Squat rack", type: MachineType.VRIJE_GEWICHTEN, description: "Rack for barbell squats." },
    ],
    exercises: [
      { name: "Rowing", targetMuscle: "Back", machine: "Rowing machine" },
      { name: "Barbell squat", targetMuscle: "Legs", machine: "Squat rack", catalogName: "barbell full squat" },
      { name: "Burpee", targetMuscle: "Full body", machine: null, catalogName: "burpee" },
    ],
    templates: [
      {
        name: "Iron Conditioning",
        description: "Strength + conditioning.",
        items: [
          { exercise: "Barbell squat", sets: 5, reps: 5, restSeconds: 120 },
          { exercise: "Rowing", sets: 1, reps: 20, restSeconds: 0 },
          { exercise: "Burpee", sets: 3, reps: 12, restSeconds: 45 },
        ],
      },
    ],
  });

  // Trainingsactiviteit voor het owner-dashboard (laatste ~12 weken).
  await seedActivity("fitpower", { days: 84, trainProbability: 0.5 });
  await seedActivity("ironhouse", { days: 30, trainProbability: 0.45 });

  // Toegewezen schema's zodat de member-views data tonen.
  await seedAssignment("fitpower", "sven@fitpower.nl", "Full Body Start");
  await seedAssignment("fitpower", "lisa@fitpower.nl", "Cardio + Core");

  // Groepslessen.
  await seedRooster("fitpower");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
