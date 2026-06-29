import { PrismaClient, MachineType, Role } from "@prisma/client";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

/** Genereer een random 16-karakter qrToken (hex). */
function qrToken(): string {
  return randomBytes(8).toString("hex"); // 16 hex-chars
}

async function main() {
  const slug = "fitpower";

  // Maak (of update) de demo-tenant.
  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      name: "FitPower Leeuwarden",
      accentColor: "#E84B1F",
      locale: "NL",
      aiEnabled: false,
    },
  });

  // Idempotent: ruim bestaande child-data van deze tenant op, in FK-volgorde.
  await prisma.performanceEntry.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.workoutSession.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.assignedWorkout.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.workoutExerciseItem.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.workoutTemplate.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.exercise.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.machine.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.user.deleteMany({ where: { tenantId: tenant.id } });

  // --- Gebruikers: 1 owner + 3 members ---
  const owner = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "owner@fitpower.nl",
      name: "Bea Eigenaar",
      role: Role.OWNER,
    },
  });

  const members = await Promise.all(
    [
      { email: "sven@fitpower.nl", name: "Sven Sporter" },
      { email: "lisa@fitpower.nl", name: "Lisa Lifter" },
      { email: "tom@fitpower.nl", name: "Tom Trainer" },
    ].map((m) =>
      prisma.user.create({
        data: { tenantId: tenant.id, role: Role.MEMBER, ...m },
      })
    )
  );

  // --- 5 machines ---
  const machineData = [
    { name: "Loopband", type: MachineType.CARDIO, description: "Hardlopen en wandelen op snelheid." },
    { name: "Crosstrainer", type: MachineType.CARDIO, description: "Low-impact cardio voor het hele lichaam." },
    { name: "Beenpers", type: MachineType.KRACHT, description: "Krachttraining voor de benen." },
    { name: "Lat pulldown", type: MachineType.KRACHT, description: "Trekoefening voor de rug." },
    { name: "Halterbank", type: MachineType.VRIJE_GEWICHTEN, description: "Verstelbare bank voor halteroefeningen." },
  ];
  const machines = await Promise.all(
    machineData.map((m) =>
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
  const [loopband, crosstrainer, beenpers, latPulldown, halterbank] = machines;

  // --- 10 oefeningen (mix machine + lichaamsgewicht) ---
  const exerciseData = [
    { name: "Hardlopen", targetMuscle: "Cardio", machineId: loopband.id },
    { name: "Crosstrainen", targetMuscle: "Cardio", machineId: crosstrainer.id },
    { name: "Beenpers", targetMuscle: "Quadriceps", machineId: beenpers.id },
    { name: "Lat pulldown", targetMuscle: "Latissimus", machineId: latPulldown.id },
    { name: "Bankdrukken", targetMuscle: "Borst", machineId: halterbank.id },
    { name: "Biceps curl", targetMuscle: "Biceps", machineId: halterbank.id },
    { name: "Squat", targetMuscle: "Benen", machineId: null },
    { name: "Push-up", targetMuscle: "Borst", machineId: null },
    { name: "Plank", targetMuscle: "Core", machineId: null },
    { name: "Lunges", targetMuscle: "Benen", machineId: null },
  ];
  const exercises = await Promise.all(
    exerciseData.map((e) =>
      prisma.exercise.create({
        data: {
          tenantId: tenant.id,
          name: e.name,
          targetMuscle: e.targetMuscle,
          machineId: e.machineId,
          description: `${e.name} — gericht op ${e.targetMuscle.toLowerCase()}.`,
        },
      })
    )
  );
  const byName = (n: string) => {
    const ex = exercises.find((e) => e.name === n);
    if (!ex) throw new Error(`Oefening niet gevonden: ${n}`);
    return ex;
  };

  // --- 2 library-templates met oefeningen ---
  await prisma.workoutTemplate.create({
    data: {
      tenantId: tenant.id,
      name: "Full Body Start",
      description: "Rustige start voor het hele lichaam.",
      isLibrary: true,
      items: {
        create: [
          { tenantId: tenant.id, exerciseId: byName("Beenpers").id, order: 0, sets: 3, reps: 12, restSeconds: 60 },
          { tenantId: tenant.id, exerciseId: byName("Lat pulldown").id, order: 1, sets: 3, reps: 10, restSeconds: 60 },
          { tenantId: tenant.id, exerciseId: byName("Bankdrukken").id, order: 2, sets: 3, reps: 10, restSeconds: 75 },
          { tenantId: tenant.id, exerciseId: byName("Plank").id, order: 3, sets: 3, reps: 30, restSeconds: 45 },
        ],
      },
    },
  });

  await prisma.workoutTemplate.create({
    data: {
      tenantId: tenant.id,
      name: "Cardio + Core",
      description: "Conditie en buikspieren.",
      isLibrary: true,
      items: {
        create: [
          { tenantId: tenant.id, exerciseId: byName("Hardlopen").id, order: 0, sets: 1, reps: 20, restSeconds: 0 },
          { tenantId: tenant.id, exerciseId: byName("Crosstrainen").id, order: 1, sets: 1, reps: 15, restSeconds: 0 },
          { tenantId: tenant.id, exerciseId: byName("Squat").id, order: 2, sets: 3, reps: 15, restSeconds: 45 },
          { tenantId: tenant.id, exerciseId: byName("Plank").id, order: 3, sets: 3, reps: 40, restSeconds: 45 },
        ],
      },
    },
  });

  console.log(
    `Seed klaar voor tenant "${tenant.name}" (${slug}): ` +
      `1 owner (${owner.email}), ${members.length} members, ` +
      `${machines.length} machines, ${exercises.length} oefeningen, 2 templates.`
  );
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
