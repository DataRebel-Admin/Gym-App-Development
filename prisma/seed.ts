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
    data: { tenantId: tenant.id, role: Role.OWNER, ...spec.owner },
  });
  await Promise.all(
    spec.members.map((m) =>
      prisma.user.create({ data: { tenantId: tenant.id, role: Role.MEMBER, ...m } })
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

  // Oefeningen.
  const exercises = await Promise.all(
    spec.exercises.map((e) =>
      prisma.exercise.create({
        data: {
          tenantId: tenant.id,
          name: e.name,
          targetMuscle: e.targetMuscle,
          machineId: e.machine ? machineByName.get(e.machine)?.id ?? null : null,
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

async function main() {
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
      { name: "Beenpers", targetMuscle: "Quadriceps", machine: "Beenpers" },
      { name: "Lat pulldown", targetMuscle: "Latissimus", machine: "Lat pulldown" },
      { name: "Bankdrukken", targetMuscle: "Borst", machine: "Halterbank" },
      { name: "Biceps curl", targetMuscle: "Biceps", machine: "Halterbank" },
      { name: "Squat", targetMuscle: "Benen", machine: null },
      { name: "Push-up", targetMuscle: "Borst", machine: null },
      { name: "Plank", targetMuscle: "Core", machine: null },
      { name: "Lunges", targetMuscle: "Benen", machine: null },
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
      { name: "Barbell squat", targetMuscle: "Legs", machine: "Squat rack" },
      { name: "Burpee", targetMuscle: "Full body", machine: null },
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
