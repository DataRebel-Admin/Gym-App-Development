import { PrismaClient, MachineType, Role, Locale } from "@prisma/client";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { snapshotOf } from "../lib/schema-diff";

const prisma = new PrismaClient();

/** Demo-wachtwoord voor álle geseede accounts, zodat wachtwoord- én magic-link-
 *  login werken (magic link vereist een geactiveerd account = wachtwoord gezet).
 *  Voldoet aan het wachtwoordbeleid (12+, hoofd/klein/cijfer/speciaal). */
const DEMO_PASSWORD = "GymRebelDemo123!";
const DEMO_PASSWORD_HASH = bcrypt.hashSync(DEMO_PASSWORD, 12);

/** Genereer een random 16-karakter qrToken (hex). */
function qrToken(): string {
  return randomBytes(8).toString("hex"); // 16 hex-chars
}

type ExerciseSpec = {
  name: string;
  targetMuscle: string;
  machine: string | null; // machine-naam binnen dezelfde tenant, of null (lichaamsgewicht)
  catalogName?: string; // exacte naam in ExerciseCatalog (lowercase) → koppelt media/instructies
  exerciseType?: string; // registry-key (lib/exercise-types.ts); default "strength"
};

type ItemSpec = {
  exercise: string;
  sets: number;
  reps: number;
  restSeconds: number;
  weightKg?: number;
  tempo?: string;
  notes?: string;
  // Type-specifieke doel-parameters (canoniek: seconden/meters). Voor niet-kracht-
  // oefeningen, bv. { timeSeconds: 1800, distanceM: 5000, intensity: "middel" }.
  params?: Record<string, number | string>;
};
type DaySpec = { name: string; notes?: string; items: ItemSpec[] };

type TemplateSpec = {
  name: string;
  description: string;
  coachNote?: string;
  /** Neutraal trainingsdoel (key uit lib/training-goals.ts). */
  goal?: string;
  // Eén van beide: meerdaagse `days` of platte `items` (→ "Dag 1").
  days?: DaySpec[];
  items?: ItemSpec[];
};

/** Herbruikbare trainingsdag in de bibliotheek (WorkoutTemplate kind = DAY). */
type DayTemplateSpec = { name: string; notes?: string; items: ItemSpec[] };

type TenantSpec = {
  slug: string;
  name: string;
  accentColor: string;
  locale: Locale;
  aiEnabled?: boolean;
  owner: { email: string; name: string };
  staff?: { email: string; name: string }[];
  members: { email: string; name: string }[];
  machines: { name: string; type: MachineType; description: string }[];
  exercises: ExerciseSpec[];
  templates: TemplateSpec[];
  dayTemplates?: DayTemplateSpec[];
};

/** Normaliseer een TemplateSpec naar dagen (platte items → één "Dag 1"). */
function toDays(spec: { days?: DaySpec[]; items?: ItemSpec[] }): DaySpec[] {
  if (spec.days && spec.days.length > 0) return spec.days;
  return [{ name: "Dag 1", items: spec.items ?? [] }];
}

/**
 * Maak een (library-)template met dagen + oefeningen. Items worden per dag
 * aangemaakt mét expliciete `templateId` (de template-relatie wordt niet
 * auto-gekoppeld via de geneste day-create).
 */
async function createTemplate(
  tenantId: string,
  exerciseByName: Map<string, { id: string }>,
  opts: {
    name: string;
    description?: string | null;
    coachNote?: string | null;
    isLibrary: boolean;
    kind: "SCHEMA" | "DAY";
    goal?: string | null;
    days: DaySpec[];
  }
) {
  const tpl = await prisma.workoutTemplate.create({
    data: {
      tenantId,
      name: opts.name,
      description: opts.description ?? null,
      coachNote: opts.coachNote ?? null,
      isLibrary: opts.isLibrary,
      kind: opts.kind,
      goal: opts.goal ?? null,
    },
  });
  for (const [di, d] of opts.days.entries()) {
    await prisma.workoutDay.create({
      data: {
        tenantId,
        templateId: tpl.id,
        order: di,
        name: d.name,
        notes: d.notes ?? null,
        items: {
          create: d.items.map((it, ii) => {
            const ex = exerciseByName.get(it.exercise);
            if (!ex) throw new Error(`Oefening niet gevonden: ${it.exercise}`);
            return {
              tenantId,
              templateId: tpl.id,
              exerciseId: ex.id,
              order: ii,
              sets: it.sets,
              reps: it.reps,
              restSeconds: it.restSeconds,
              weightKg: it.weightKg ?? null,
              tempo: it.tempo ?? null,
              params: it.params ?? undefined,
              notes: it.notes ?? null,
            };
          }),
        },
      },
    });
  }
  return tpl;
}

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
  await prisma.workoutDay.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.workoutTemplate.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.exercise.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.machine.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.user.deleteMany({ where: { tenantId: tenant.id } });

  // Gebruikers. Elk demo-account krijgt het demo-wachtwoord (geactiveerd) zodat
  // zowel wachtwoord- als magic-link-login werkt.
  await prisma.user.create({
    data: { tenantId: tenant.id, role: Role.TENANT_ADMIN, passwordHash: DEMO_PASSWORD_HASH, emailVerified: new Date(), ...spec.owner },
  });
  await Promise.all(
    (spec.staff ?? []).map((s) =>
      prisma.user.create({ data: { tenantId: tenant.id, role: Role.TENANT_STAFF, passwordHash: DEMO_PASSWORD_HASH, emailVerified: new Date(), ...s } })
    )
  );
  await Promise.all(
    spec.members.map((m) =>
      prisma.user.create({ data: { tenantId: tenant.id, role: Role.TENANT_MEMBER, passwordHash: DEMO_PASSWORD_HASH, emailVerified: new Date(), ...m } })
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
          exerciseType: e.exerciseType ?? "strength",
          description: `${e.name} — gericht op ${e.targetMuscle.toLowerCase()}.`,
        },
      })
    )
  );
  const exerciseByName = new Map(exercises.map((e) => [e.name, e]));

  // Library-schema's (kind = SCHEMA), met dagen, coach-notities en tempo.
  for (const tpl of spec.templates) {
    await createTemplate(tenant.id, exerciseByName, {
      name: tpl.name,
      description: tpl.description,
      coachNote: tpl.coachNote ?? null,
      isLibrary: true,
      kind: "SCHEMA",
      goal: tpl.goal ?? null,
      days: toDays(tpl),
    });
  }

  // Herbruikbare dag-templates (kind = DAY) — bouwstenen voor schema's.
  for (const dt of spec.dayTemplates ?? []) {
    await createTemplate(tenant.id, exerciseByName, {
      name: dt.name,
      description: null,
      isLibrary: true,
      kind: "DAY",
      days: [{ name: dt.name, notes: dt.notes, items: dt.items }],
    });
  }

  console.log(
    `✓ ${spec.name} (${spec.slug}): 1 owner, ${spec.members.length} members, ` +
      `${machines.length} machines, ${exercises.length} oefeningen, ` +
      `${spec.templates.length} schema's, ${(spec.dayTemplates ?? []).length} dag-templates.`
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

/**
 * Wijs een lid een gekloond, lid-specifiek schema toe op basis van een
 * library-master, inclusief baseline-snapshot (master ↔ persoonlijke kopie).
 * Retourneert de id van de gekloonde (persoonlijke) template.
 */
async function seedAssignment(
  slug: string,
  memberEmail: string,
  templateName: string,
  opts?: { seen?: boolean; trainerMessage?: string }
): Promise<string | null> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug } });
  const member = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: memberEmail, role: "TENANT_MEMBER" },
  });
  const source = await prisma.workoutTemplate.findFirst({
    where: { tenantId: tenant.id, isLibrary: true, name: templateName },
    include: {
      days: { orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" } } } },
    },
  });
  if (!member || !source) return null;

  const clone = await prisma.workoutTemplate.create({
    data: {
      tenantId: tenant.id,
      name: source.name,
      description: source.description,
      coachNote: source.coachNote,
      isLibrary: false,
    },
  });
  for (const d of source.days) {
    await prisma.workoutDay.create({
      data: {
        tenantId: tenant.id,
        templateId: clone.id,
        order: d.order,
        name: d.name,
        notes: d.notes,
        items: {
          create: d.items.map((it) => ({
            tenantId: tenant.id,
            templateId: clone.id,
            exerciseId: it.exerciseId,
            order: it.order,
            sets: it.sets,
            reps: it.reps,
            restSeconds: it.restSeconds,
            weightKg: it.weightKg,
            tempo: it.tempo,
            params: it.params ?? undefined,
            notes: it.notes,
          })),
        },
      },
    });
  }
  await prisma.assignedWorkout.create({
    data: {
      tenantId: tenant.id,
      userId: member.id,
      templateId: clone.id,
      sourceTemplateId: source.id,
      status: "PUBLISHED",
      publishedAt: new Date(),
      startDate: new Date(),
      seenAt: opts?.seen === false ? null : new Date(),
      trainerMessage: opts?.trainerMessage ?? null,
      baselineSnapshot: snapshotOf(source),
      masterSyncedAt: source.updatedAt,
    },
  });
  console.log(`  ↳ schema toegewezen: ${memberEmail} ← ${templateName}`);
  return clone.id;
}

/**
 * Personaliseer een gekloond schema (maakt het "Aangepast" t.o.v. de baseline):
 * pas het gewicht/de reps van de eerste oefening aan en zet een persoonlijke
 * notitie. Demonstreert de drift-badges + vergelijkingsscherm.
 */
async function personalizeClone(cloneId: string) {
  const first = await prisma.workoutExerciseItem.findFirst({
    where: { templateId: cloneId },
    orderBy: [{ dayId: "asc" }, { order: "asc" }],
  });
  if (!first) return;
  await prisma.workoutExerciseItem.update({
    where: { id: first.id },
    data: {
      weightKg: (first.weightKg ?? 20) + 7.5,
      reps: first.reps + 2,
      notes: "Persoonlijk: rustig opbouwen, let op je rug.",
    },
  });
  console.log(`  ↳ schema gepersonaliseerd: kloon ${cloneId}`);
}

/**
 * Wijzig een library-master ná toewijzing (voegt een coach-notitie toe), zodat
 * `master.updatedAt > masterSyncedAt` → "Sync beschikbaar" bij de toewijzingen.
 */
async function bumpMaster(slug: string, templateName: string) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug } });
  const master = await prisma.workoutTemplate.findFirst({
    where: { tenantId: tenant.id, isLibrary: true, name: templateName },
  });
  if (!master) return;
  await prisma.workoutTemplate.update({
    where: { id: master.id },
    data: { coachNote: "Update: focus deze blok op een strakke uitvoering." },
  });
  console.log(`  ↳ master gewijzigd (sync beschikbaar): ${templateName}`);
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
      email: "admin@datarebel.nl",
      name: "Platform Beheer",
      role: Role.SUPERADMIN,
      tenantId: null,
      passwordHash: DEMO_PASSWORD_HASH,
      emailVerified: new Date(),
    },
  });
  console.log("✓ admin@datarebel.nl (geen tenant)");

  // Tenant 1 — rijke demo.
  await seedTenant({
    slug: "fitpower",
    name: "FitPower Leeuwarden",
    accentColor: "#E84B1F",
    locale: Locale.NL,
    owner: { email: "owner@fitpower.nl", name: "Bea Eigenaar" },
    staff: [{ email: "coach@fitpower.nl", name: "Coen Coach" }],
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
      { name: "Hardlopen", targetMuscle: "Cardio", machine: "Loopband", exerciseType: "cardio" },
      { name: "Crosstrainen", targetMuscle: "Cardio", machine: "Crosstrainer", exerciseType: "cardio" },
      { name: "Beenpers", targetMuscle: "Quadriceps", machine: "Beenpers", catalogName: "lever alternate leg press" },
      { name: "Lat pulldown", targetMuscle: "Latissimus", machine: "Lat pulldown", catalogName: "cable lat pulldown full range of motion" },
      { name: "Bankdrukken", targetMuscle: "Borst", machine: "Halterbank", catalogName: "barbell bench press" },
      { name: "Biceps curl", targetMuscle: "Biceps", machine: "Halterbank", catalogName: "dumbbell biceps curl" },
      { name: "Squat", targetMuscle: "Benen", machine: null, catalogName: "dumbbell squat" },
      { name: "Push-up", targetMuscle: "Borst", machine: null, catalogName: "push-up" },
      { name: "Plank", targetMuscle: "Core", machine: null, catalogName: "front plank with twist", exerciseType: "isometric" },
      { name: "Lunges", targetMuscle: "Benen", machine: null, catalogName: "dumbbell lunge" },
      // Bredere mix van oefeningstypes — zodat de bibliotheek uiteenlopende
      // trainingsdoelen bedient (niet alleen kracht/bodybuilding).
      { name: "Bird dog", targetMuscle: "Core & rug", machine: null, exerciseType: "stability" },
      { name: "Dead bug", targetMuscle: "Core", machine: null, exerciseType: "core" },
      { name: "Glute bridge", targetMuscle: "Bilspieren", machine: null, exerciseType: "rehab" },
      { name: "Kettlebell swing", targetMuscle: "Hele lichaam", machine: null, exerciseType: "functional" },
      { name: "Farmer's carry", targetMuscle: "Hele lichaam", machine: null, exerciseType: "functional" },
      { name: "Schoudermobiliteit", targetMuscle: "Schouders", machine: null, exerciseType: "mobility" },
      { name: "Heupflexor-stretch", targetMuscle: "Heupen", machine: null, exerciseType: "stretch" },
    ],
    // Bewust een brede spreiding aan trainingsdoelen — de bibliotheek is er voor
    // élke sporter (kracht, conditie, mobiliteit, herstel …), niet één doelgroep.
    templates: [
      {
        name: "Beginner Full Body",
        description: "Rustige start voor het hele lichaam — geschikt voor iedereen.",
        coachNote: "Techniek boven gewicht — bouw rustig op deze eerste weken.",
        goal: "health",
        days: [
          {
            name: "Dag 1 — Onderlichaam",
            notes: "Warm goed op met 5 min cardio.",
            items: [
              { exercise: "Beenpers", sets: 3, reps: 12, restSeconds: 60, weightKg: 40, tempo: "3-1-1" },
              { exercise: "Squat", sets: 3, reps: 12, restSeconds: 60, notes: "Knieën naar buiten." },
              { exercise: "Plank", sets: 3, reps: 30, restSeconds: 45, params: { holdSeconds: 30 } },
            ],
          },
          {
            name: "Dag 2 — Bovenlichaam",
            items: [
              { exercise: "Bankdrukken", sets: 3, reps: 10, restSeconds: 75, weightKg: 30, tempo: "2-0-2" },
              { exercise: "Lat pulldown", sets: 3, reps: 10, restSeconds: 60 },
              { exercise: "Biceps curl", sets: 3, reps: 12, restSeconds: 45 },
            ],
          },
        ],
      },
      {
        name: "Kracht & Conditie",
        description: "Combineer krachtoefeningen met cardio voor een sterke, fitte basis.",
        goal: "strength",
        days: [
          {
            name: "Dag 1",
            items: [
              { exercise: "Squat", sets: 4, reps: 8, restSeconds: 90 },
              { exercise: "Bankdrukken", sets: 4, reps: 8, restSeconds: 90, weightKg: 35 },
              { exercise: "Lat pulldown", sets: 3, reps: 10, restSeconds: 75 },
              {
                exercise: "Hardlopen", sets: 1, reps: 0, restSeconds: 0,
                params: { timeSeconds: 600, distanceM: 2000, intensity: "hoog", hrZone: "zone4" },
              },
            ],
          },
        ],
      },
      {
        name: "Mobiliteit & Herstel",
        description: "Soepeler bewegen en spanning loslaten — ideaal op een rustdag.",
        goal: "mobility",
        days: [
          {
            name: "Dag 1",
            items: [
              { exercise: "Schoudermobiliteit", sets: 1, reps: 0, restSeconds: 0, params: { timeSeconds: 90, side: "beide" } },
              { exercise: "Heupflexor-stretch", sets: 1, reps: 0, restSeconds: 0, params: { timeSeconds: 60, reps: 2 } },
              { exercise: "Bird dog", sets: 1, reps: 0, restSeconds: 0, params: { holdSeconds: 30, side: "beide" } },
            ],
          },
        ],
      },
      {
        name: "Functional Fitness",
        description: "Samengestelde bewegingen voor kracht die je dagelijks gebruikt.",
        goal: "sport",
        days: [
          {
            name: "Dag 1",
            items: [
              { exercise: "Kettlebell swing", sets: 4, reps: 15, restSeconds: 60 },
              { exercise: "Farmer's carry", sets: 3, reps: 0, restSeconds: 60, notes: "Loop 20 meter." },
              { exercise: "Lunges", sets: 3, reps: 12, restSeconds: 60 },
              { exercise: "Push-up", sets: 3, reps: 12, restSeconds: 45 },
            ],
          },
        ],
      },
      {
        name: "Core Stability",
        description: "Bouw een stabiele romp en betere balans op.",
        goal: "stability",
        days: [
          {
            name: "Dag 1",
            items: [
              { exercise: "Dead bug", sets: 3, reps: 12, restSeconds: 45 },
              { exercise: "Bird dog", sets: 3, reps: 0, restSeconds: 45, params: { holdSeconds: 30, side: "beide" } },
              { exercise: "Plank", sets: 3, reps: 40, restSeconds: 45, params: { holdSeconds: 40 } },
              { exercise: "Glute bridge", sets: 3, reps: 15, restSeconds: 45 },
            ],
          },
        ],
      },
      {
        name: "Hypertrofie",
        description: "Gericht op spieropbouw met hogere volumes.",
        goal: "muscle",
        days: [
          {
            name: "Dag 1",
            items: [
              { exercise: "Bankdrukken", sets: 4, reps: 12, restSeconds: 75, weightKg: 30 },
              { exercise: "Lat pulldown", sets: 4, reps: 12, restSeconds: 75 },
              { exercise: "Beenpers", sets: 4, reps: 12, restSeconds: 75, weightKg: 50 },
              { exercise: "Biceps curl", sets: 3, reps: 15, restSeconds: 45 },
            ],
          },
        ],
      },
      {
        name: "Afvallen",
        description: "Vet verliezen met een mix van cardio en circuittraining.",
        goal: "fat_loss",
        days: [
          {
            name: "Dag 1",
            items: [
              {
                exercise: "Crosstrainen", sets: 1, reps: 0, restSeconds: 0,
                params: { timeSeconds: 900, distanceM: 3000, intensity: "middel" },
              },
              { exercise: "Squat", sets: 3, reps: 15, restSeconds: 40 },
              { exercise: "Lunges", sets: 3, reps: 12, restSeconds: 40 },
              { exercise: "Plank", sets: 3, reps: 40, restSeconds: 40, params: { holdSeconds: 40 } },
            ],
          },
        ],
      },
      {
        name: "Hardlopen",
        description: "Bouw je conditie en uithoudingsvermogen op.",
        goal: "conditioning",
        days: [
          {
            name: "Dag 1",
            items: [
              {
                exercise: "Hardlopen", sets: 1, reps: 0, restSeconds: 0,
                params: { timeSeconds: 1800, distanceM: 5000, intensity: "middel", hrZone: "zone3" },
              },
            ],
          },
        ],
      },
      {
        name: "Hersteltraining",
        description: "Rustige, gecontroleerde oefeningen om blessurevrij te blijven.",
        coachNote: "Twijfel je bij een oefening? Raadpleeg altijd een professional.",
        goal: "rehab",
        days: [
          {
            name: "Dag 1",
            items: [
              { exercise: "Glute bridge", sets: 3, reps: 12, restSeconds: 60, params: { reps: 12, side: "beide" } },
              { exercise: "Bird dog", sets: 3, reps: 0, restSeconds: 45, params: { holdSeconds: 20, side: "beide" } },
              { exercise: "Heupflexor-stretch", sets: 1, reps: 0, restSeconds: 0, params: { timeSeconds: 60, reps: 2 } },
            ],
          },
        ],
      },
    ],
    dayTemplates: [
      {
        name: "Push",
        notes: "Borst, schouders, triceps.",
        items: [
          { exercise: "Bankdrukken", sets: 4, reps: 8, restSeconds: 90, tempo: "2-1-2" },
          { exercise: "Push-up", sets: 3, reps: 12, restSeconds: 60 },
        ],
      },
      {
        name: "Pull",
        notes: "Rug en biceps.",
        items: [
          { exercise: "Lat pulldown", sets: 4, reps: 10, restSeconds: 90 },
          { exercise: "Biceps curl", sets: 3, reps: 12, restSeconds: 60 },
        ],
      },
      {
        name: "Legs",
        notes: "Benen en core.",
        items: [
          { exercise: "Beenpers", sets: 4, reps: 12, restSeconds: 90 },
          { exercise: "Lunges", sets: 3, reps: 12, restSeconds: 60 },
          { exercise: "Plank", sets: 3, reps: 45, restSeconds: 45, params: { holdSeconds: 45 } },
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
          { exercise: "Barbell squat", sets: 5, reps: 5, restSeconds: 120, weightKg: 60, tempo: "2-1-1" },
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
  // Sven: gepersonaliseerd schema (badge "Aangepast" + vergelijking).
  const svenClone = await seedAssignment("fitpower", "sven@fitpower.nl", "Beginner Full Body", {
    trainerMessage: "Welkom Sven! Dit is je startschema — vragen? App me gerust.",
  });
  if (svenClone) await personalizeClone(svenClone);
  // Lisa: standaard kopie van hetzelfde schema (badge "Standaard").
  await seedAssignment("fitpower", "lisa@fitpower.nl", "Beginner Full Body", { seen: false });
  await seedAssignment("fitpower", "tom@fitpower.nl", "Hardlopen");

  // Master ná toewijzing wijzigen → "Sync beschikbaar" bij Sven & Lisa.
  await bumpMaster("fitpower", "Beginner Full Body");

  // Trofeeën/achievements aan voor fitpower + demo-toekenningen op basis van de
  // geseede trainingsactiviteit (zodat dashboards/coach-overzicht data tonen).
  await seedAchievements("fitpower");

  // Groepslessen.
  await seedRooster("fitpower");
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Zet het trofeeën-systeem aan voor een tenant en kent demo-achievements toe op
 * basis van de geseede trainingsactiviteit. Zelfstandig (geen import van de
 * `server-only` engine): de tier-tabellen spiegelen lib/achievements/definitions.ts.
 * `celebratedAt` wordt gezet zodat demo-leden geen celebration-vloedgolf krijgen.
 */
async function seedAchievements(slug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return;
  await prisma.tenant.update({ where: { id: tenant.id }, data: { achievementsEnabled: true } });

  const trainingTiers: [string, number, string][] = [
    ["training.first", 1, "bronze"],
    ["training.count_10", 10, "bronze"],
    ["training.count_50", 50, "silver"],
    ["training.count_100", 100, "gold"],
    ["training.count_250", 250, "platinum"],
    ["training.count_500", 500, "diamond"],
  ];
  const streakTiers: [string, number, string][] = [
    ["consistency.streak_3", 3, "bronze"],
    ["consistency.streak_7", 7, "silver"],
    ["consistency.streak_30", 30, "gold"],
    ["consistency.streak_100", 100, "diamond"],
  ];
  const volumeTiers: [string, number, string][] = [
    ["strength.volume_100", 100, "bronze"],
    ["strength.volume_1000", 1000, "silver"],
    ["strength.volume_10000", 10000, "gold"],
    ["strength.volume_100000", 100000, "platinum"],
    ["strength.volume_1000000", 1000000, "legendary"],
  ];

  const members = await prisma.user.findMany({
    where: { tenantId: tenant.id, role: "TENANT_MEMBER" },
    select: { id: true },
  });

  const now = new Date();
  for (const member of members) {
    const sessions = await prisma.workoutSession.findMany({
      where: { tenantId: tenant.id, userId: member.id, endedAt: { not: null } },
      select: { startedAt: true, performanceEntries: { select: { reps: true, weightKg: true } } },
    });
    if (sessions.length === 0) continue;

    const totalWorkouts = sessions.length;
    let totalVolume = 0;
    let hasPr = false;
    const dayStarts = new Set<number>();
    for (const s of sessions) {
      const d = new Date(s.startedAt);
      d.setHours(0, 0, 0, 0);
      dayStarts.add(d.getTime());
      for (const e of s.performanceEntries) {
        totalVolume += e.reps * e.weightKg;
        if (e.weightKg > 0) hasPr = true;
      }
    }
    const sortedDays = [...dayStarts].sort((a, b) => a - b);
    let longestStreak = 1;
    let run = 1;
    for (let i = 1; i < sortedDays.length; i++) {
      run = sortedDays[i] - sortedDays[i - 1] === DAY_MS ? run + 1 : 1;
      if (run > longestStreak) longestStreak = run;
    }

    const rows: { key: string; category: string; rarity: string; value: number }[] = [];
    for (const [key, threshold, rarity] of trainingTiers) {
      if (totalWorkouts >= threshold) rows.push({ key, category: "training", rarity, value: totalWorkouts });
    }
    for (const [key, threshold, rarity] of streakTiers) {
      if (longestStreak >= threshold) rows.push({ key, category: "consistency", rarity, value: longestStreak });
    }
    for (const [key, threshold, rarity] of volumeTiers) {
      if (totalVolume >= threshold) rows.push({ key, category: "strength", rarity, value: Math.round(totalVolume) });
    }
    if (hasPr) rows.push({ key: "strength.first_pr", category: "strength", rarity: "bronze", value: 1 });

    if (rows.length === 0) continue;
    await prisma.earnedAchievement.createMany({
      data: rows.map((r) => ({
        tenantId: tenant.id,
        userId: member.id,
        key: r.key,
        category: r.category,
        rarity: r.rarity,
        value: r.value,
        earnedAt: now,
        celebratedAt: now,
      })),
      skipDuplicates: true,
    });
  }
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
