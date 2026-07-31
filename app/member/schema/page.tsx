import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireMember, getAssignedSchema } from "@/lib/member";
import { getMemberSchemaMode, canEditAssignedSchema } from "@/lib/member-schema";
import { isEditableMemberStatus } from "@/lib/member-schema-status";
import { enforceSessionTimeout } from "@/lib/session-timeout";
import { MarkAutoStopSeen } from "@/components/member/mark-auto-stop-seen";
import { EmptyState } from "@/components/ui/empty-state";
import { Dumbbell, Play, Download, CalendarDays, QrCode, ClipboardList, PersonStanding, Pencil } from "@/components/ui/icons";
import {
  SchemaOverview,
  type OverviewItem,
  type OverviewDay,
} from "./schema-overview";
import { startSession } from "./actions";
import { StartSessionButton } from "./start-session-button";
import { MarkSchemaSeen } from "@/components/member/mark-schema-seen";
import { LocationSwitcher } from "@/components/member/location-switcher";
import { getTenantLocations } from "@/lib/locations";
import { resolveActiveLocationId } from "@/lib/location-resolve";
import { SchemaBadges } from "@/components/schema/schema-badges";
import { SchemaCover } from "@/components/schema/schema-cover";
import { schemaImage } from "@/lib/schema-image";
import { getCurrentTenant } from "@/lib/tenant";
import { SchemaProgressCard } from "@/components/member/schema-progress-card";
import { getSchemaProgress, daysAgo } from "@/lib/schema-progress";
import { exerciseTypeLabel } from "@/lib/exercise-types";
import { targetSummaryFromItem } from "@/lib/exercise-params";
import { pickGroupFields } from "@/lib/exercise-groups";
import { exerciseThumbUrl, type ExerciseThumbSource } from "@/lib/exercise-thumb";
import { computeValidity, trainerDisplayName } from "@/lib/schema-status";
import { requestKindHref } from "@/lib/schema-requests";

type ItemWithRel = {
  id: string;
  exerciseId: string;
  sets: number;
  reps: number;
  restSeconds: number;
  weightKg: number | null;
  tempo: string | null;
  params: unknown;
  notes: string | null;
  memberNote: string | null;
  groupId: string | null;
  groupType: string | null;
  groupOrder: number;
  groupRounds: number | null;
  groupRestSeconds: number | null;
  groupLabel: string | null;
  groupTimeCapSeconds: number | null;
  dropsetCount: number | null;
  exercise: {
    name: string;
    exerciseType: string;
    machine: { name: string } | null;
  } & ExerciseThumbSource;
};

function toOverviewItem(it: ItemWithRel): OverviewItem {
  const type = it.exercise.exerciseType;
  return {
    id: it.id,
    exerciseId: it.exerciseId,
    exerciseName: it.exercise.name,
    machineName: it.exercise.machine?.name ?? null,
    summary: targetSummaryFromItem(it, type),
    typeLabel: exerciseTypeLabel(type),
    notes: it.notes,
    memberNote: it.memberNote,
    thumbUrl: exerciseThumbUrl(it.exercise),
    ...pickGroupFields(it),
  };
}

export async function generateMetadata() {
  const t = await getTranslations("member.schema");
  return { title: t("metaTitle") };
}

export default async function MemberSchemaPage() {
  const member = await requireMember();

  // Automatische 5-uur-timeout: sluit een te lang openstaande sessie af als het
  // lid hier terugkomt na de app lang gesloten te hebben gehad.
  await enforceSessionTimeout(member.tenantId, member.id);

  const [assignment, t, memberSchemaMode, assignedEditable, autoStopped, locations, me] =
    await Promise.all([
    getAssignedSchema(member.id, member.tenantId),
    getTranslations("member.schema"),
    getMemberSchemaMode(member.tenantId),
    canEditAssignedSchema(member.tenantId),
    prisma.workoutSession.findFirst({
      where: {
        tenantId: member.tenantId,
        userId: member.id,
        autoStoppedAt: { not: null },
        autoStopNotified: false,
      },
      orderBy: { autoStoppedAt: "desc" },
      select: { id: true },
    }),
    getTenantLocations(member.tenantId),
    prisma.user.findFirst({
      where: { id: member.id, tenantId: member.tenantId },
      select: { homeLocationId: true },
    }),
  ]);
  // Actieve vestiging (device-cookie → thuisvestiging → default) — de sessie
  // start hierop; bij multi-vestiging toont de switcher de keuze.
  const activeLocationId = await resolveActiveLocationId(member.tenantId, {
    homeLocationId: me?.homeLocationId,
  });
  const canBuild = memberSchemaMode !== "DISABLED";
  const schema = assignment?.template;
  // Zelf-gebouwd schema = van het lid: dat mag het altijd bewerken, behalve zolang
  // de coach het beoordeelt (dan eerst intrekken op /member/schema/builder).
  const ownEditableAssignmentId =
    assignment?.origin === "MEMBER" &&
    isEditableMemberStatus(assignment.memberStatus ?? "DRAFT")
      ? assignment.id
      : null;

  // Herkomst: naam van de trainer die dit schema toewees (zichtbare provenance).
  // Oude toewijzingen zonder `assignedById` tonen we niet (geen fallback-ruis).
  const assignedByTrainer = assignment?.assignedById
    ? await prisma.user.findFirst({
        where: { id: assignment.assignedById, tenantId: member.tenantId },
        select: { name: true, email: true },
      })
    : null;
  const assignedByName = trainerDisplayName(assignedByTrainer);
  const isNew = assignment ? assignment.seenAt === null : false;
  const trainerMessage = assignment?.trainerMessage?.trim() || null;
  const validity = assignment
    ? computeValidity(assignment.publishedAt, assignment.template?.validityWeeks ?? null)
    : computeValidity(null, null);

  const autoStopBanner = autoStopped ? (
    <>
      <MarkAutoStopSeen />
      <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
        <p className="text-sm font-semibold text-amber-700">{t("autoStopTitle")}</p>
        <p className="mt-1 text-sm text-neutral-700">{t("autoStopBody")}</p>
      </div>
    </>
  ) : null;

  if (!schema) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-5 px-5 py-10">
        {autoStopBanner}
        <EmptyState
          icon={<Dumbbell className="size-8 text-accent" />}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {canBuild ? (
                <Link
                  href="/member/schema/builder"
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground active:opacity-90"
                >
                  <Dumbbell className="size-4" /> {t("buildSelf")}
                </Link>
              ) : null}
              <Link
                href="/member/requests"
                className={
                  canBuild
                    ? "inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-neutral-700 active:bg-surface-2"
                    : "inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground active:opacity-90"
                }
              >
                <ClipboardList className="size-4" /> {t("requestSchema")}
              </Link>
              <Link
                href="/member/scan"
                className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-neutral-700 active:bg-surface-2"
              >
                <QrCode className="size-4" /> {t("scanMachine")}
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  // Toon per dag wanneer er dagen zijn; anders één platte lijst.
  const days: OverviewDay[] = schema.days.map((d) => ({
    name: d.name,
    notes: d.notes,
    items: d.items.map(toOverviewItem),
  }));
  const flatItems: OverviewItem[] = schema.items.map(toOverviewItem);
  const multiDay = days.length > 1;

  // Voortgang = wat er écht getraind is (afgeronde workouts), niet wat hier
  // afgevinkt is — afvinken gebeurt uitsluitend in de workout zelf.
  const progress = await getSchemaProgress(member.id, member.tenantId, {
    since: assignment?.publishedAt ?? null,
    dayIds: schema.days.map((d) => d.id),
  });
  const progressByDay = new Map(progress.days.map((d) => [d.dayId, d]));

  // Beeld van het schema: eigen foto (meegekloond bij toewijzen) → sportschoollogo.
  const tenant = await getCurrentTenant();
  const cover = schemaImage(schema, { logoUrl: tenant?.logoUrl ?? null });

  // Per-dag startopties: je doet één trainingsdag per sessie.
  const dayOptions = schema.days.map((d) => ({
    id: d.id,
    name: d.name,
    count: d.items.length,
    lastDaysAgo: daysAgo(progressByDay.get(d.id)?.lastTrainedAt ?? null),
  }));

  return (
    <div className="flex flex-1 flex-col gap-5 px-5 py-8">
      {isNew ? <MarkSchemaSeen /> : null}
      {autoStopBanner}
      {/* Banner i.p.v. de volle 3:2-kaart: op een telefoonscherm moet de titel
          en de startknop zonder scrollen in beeld blijven. */}
      <SchemaCover
        image={cover}
        alt={schema.name}
        aspect={false}
        priority
        className="h-36 rounded-2xl"
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
            {schema.name}
          </h1>
          {isNew ? (
            <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-accent-foreground">
              {t("newBadge")}
            </span>
          ) : null}
        </div>
        {schema.description ? (
          <p className="mt-1 text-sm text-neutral-500">{schema.description}</p>
        ) : null}
        <div className="mt-2">
          <SchemaBadges badges={schema.badges} />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-neutral-600">
            <Dumbbell className="size-3.5 text-accent" /> {t("exercisesCount", { count: schema.items.length })}
          </span>
          {multiDay ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-neutral-600">
              <CalendarDays className="size-3.5 text-accent" /> {t("daysCount", { count: days.length })}
            </span>
          ) : null}
        </div>
        {assignedByName ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
            <PersonStanding className="size-3.5 text-accent" />
            {t("assignedBy", { trainer: assignedByName })}
          </p>
        ) : null}
      </div>

      {validity.state === "expiring" || validity.state === "expired" ? (
        <div
          className={
            validity.state === "expired"
              ? "rounded-2xl border border-red-300 bg-red-50 px-4 py-3"
              : "rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3"
          }
        >
          <p
            className={
              validity.state === "expired"
                ? "text-sm font-semibold text-red-700"
                : "text-sm font-semibold text-amber-700"
            }
          >
            {validity.state === "expired"
              ? t("validityExpiredTitle")
              : t("validityExpiringTitle")}
          </p>
          <p className="mt-1 text-sm text-neutral-700">
            {validity.state === "expired"
              ? t("validityExpiredDesc")
              : t("validityExpiringDesc", { days: Math.max(0, validity.daysLeft ?? 0) })}
          </p>
          <Link
            href="/member/requests"
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground active:opacity-90"
          >
            <ClipboardList className="size-4" /> {t("requestNewSchema")}
          </Link>
        </div>
      ) : null}

      {trainerMessage ? (
        <div className="rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            {t("trainerMessage")}
          </p>
          <p className="mt-1 text-sm text-neutral-700">{trainerMessage}</p>
        </div>
      ) : null}

      {/* Starten staat bovenaan: hier begint het echte werk. Alles daaronder
          (voortgang, overzicht, downloads) is ter voorbereiding/naslag. De
          vestigingskeuze staat vóór de knop — die bepaalt waar de sessie landt. */}
      <LocationSwitcher
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        activeId={activeLocationId}
        label={t("trainingLocation")}
      />

      {multiDay ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-neutral-900">{t("chooseDay")}</p>
          {dayOptions.map((d) => (
            <form key={d.id} action={startSession}>
              <input type="hidden" name="dayId" value={d.id} />
              <StartSessionButton
                label={d.name}
                pendingLabel={t("starting")}
                className="justify-between px-6 py-4 text-left"
              >
                <span className="flex items-center gap-2 text-lg">
                  <Play className="size-5 fill-current" /> {d.name}
                </span>
                <span className="text-right text-sm font-medium text-accent-foreground/80">
                  {t("exercisesCount", { count: d.count })}
                  <span className="block text-xs">
                    {d.lastDaysAgo === null
                      ? t("progressDayNever")
                      : t("progressDayLast", { days: d.lastDaysAgo })}
                  </span>
                </span>
              </StartSessionButton>
            </form>
          ))}
        </div>
      ) : (
        <form action={startSession}>
          <StartSessionButton
            label={t("startTraining")}
            pendingLabel={t("starting")}
            className="justify-center px-6 py-5 text-lg"
          />
        </form>
      )}

      <SchemaProgressCard progress={progress} dayNames={dayOptions.map((d) => d.name)} />

      {/* De schema-notitie hoort bij het programma (geldt voor elk lid met dit
          schema) en staat daarom hier, niet bij het persoonlijke trainersbericht. */}
      {multiDay ? (
        <SchemaOverview days={days} coachNote={schema.coachNote} />
      ) : (
        <SchemaOverview items={flatItems} coachNote={schema.coachNote} />
      )}

      <a
        href="/member/schema/pdf"
        className="flex items-center justify-center gap-2 rounded-2xl border border-border px-6 py-3 text-center text-sm font-medium text-neutral-700 active:bg-surface-2"
      >
        <Download className="size-4" /> {t("downloadPdf")}
      </a>

      <Link
        href="/member/muscles"
        className="flex items-center justify-center gap-2 rounded-2xl border border-border px-6 py-3 text-center text-sm font-medium text-neutral-700 active:bg-surface-2"
      >
        <PersonStanding className="size-4 text-accent" /> {t("muscleAnalysis")}
      </Link>

      {/* Toegewezen door een trainer? Dan bewerkt het lid het niet zelf; de weg
          naar een aanpassing loopt via een aanvraag. Zonder deze link is dat
          formulier vanaf hier onvindbaar (het stond alleen in de verloop-banner). */}
      {/* Laat de sportschool het toe, dan mag het lid zijn eigen versie van het
          trainer-schema aanpassen (Tenant.memberCanEditAssigned). */}
      {assignment?.origin === "COACH" && assignedEditable ? (
        <Link
          href={`/member/schema/builder/${assignment.id}`}
          className="flex items-center justify-center gap-2 rounded-2xl border border-border px-6 py-3 text-center text-sm font-medium text-neutral-700 active:bg-surface-2"
        >
          <Pencil className="size-4 text-accent" /> {t("editAssignedSchema")}
        </Link>
      ) : null}

      {assignment?.origin === "COACH" ? (
        <Link
          href={requestKindHref("CHANGE")}
          className="flex items-center justify-center gap-2 rounded-2xl border border-border px-6 py-3 text-center text-sm font-medium text-neutral-700 active:bg-surface-2"
        >
          <ClipboardList className="size-4 text-accent" /> {t("requestChange")}
        </Link>
      ) : null}

      {/* Zelf gebouwd? Dan blijft het van het lid: direct doorklikken naar de
          editor. Ligt het bij de coach (IN_REVIEW), dan eerst intrekken via het
          overzicht — daar staat die knop. */}
      {canBuild && ownEditableAssignmentId ? (
        <Link
          href={`/member/schema/builder/${ownEditableAssignmentId}`}
          className="flex items-center justify-center gap-2 rounded-2xl border border-border px-6 py-3 text-center text-sm font-medium text-neutral-700 active:bg-surface-2"
        >
          <Pencil className="size-4 text-accent" /> {t("editOwnSchema")}
        </Link>
      ) : null}

      {/* Ook mét een actief schema bereikbaar — anders is de builder onvindbaar
          zodra een trainer al een schema heeft toegewezen. */}
      {canBuild ? (
        <Link
          href="/member/schema/builder"
          className="flex items-center justify-center gap-2 rounded-2xl border border-border px-6 py-3 text-center text-sm font-medium text-neutral-700 active:bg-surface-2"
        >
          <Pencil className="size-4 text-accent" /> {t("buildOwnSchema")}
        </Link>
      ) : null}
    </div>
  );
}
