import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireMember, getAssignedSchema } from "@/lib/member";
import { getMemberSchemaMode } from "@/lib/member-schema";
import { enforceSessionTimeout } from "@/lib/session-timeout";
import { MarkAutoStopSeen } from "@/components/member/mark-auto-stop-seen";
import { Fullscreenable, FullscreenButton } from "@/components/ui/fullscreen";
import { EmptyState } from "@/components/ui/empty-state";
import { Dumbbell, Play, Download, CalendarDays, QrCode, ClipboardList, PersonStanding } from "@/components/ui/icons";
import {
  SchemaChecklist,
  type ChecklistItem,
  type ChecklistDay,
} from "./schema-checklist";
import { startSession } from "./actions";
import { MarkSchemaSeen } from "@/components/member/mark-schema-seen";
import { SchemaBadges } from "@/components/schema/schema-badges";
import { exerciseTypeLabel } from "@/lib/exercise-types";
import { targetSummaryFromItem } from "@/lib/exercise-params";
import { computeValidity } from "@/lib/schema-status";

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
  exercise: {
    name: string;
    exerciseType: string;
    machine: { name: string } | null;
    catalog: { imageUrl: string | null; gifUrl: string | null } | null;
  };
};

function toChecklistItem(it: ItemWithRel): ChecklistItem {
  const type = it.exercise.exerciseType;
  return {
    id: it.id,
    exerciseId: it.exerciseId,
    exerciseName: it.exercise.name,
    machineName: it.exercise.machine?.name ?? null,
    summary: targetSummaryFromItem(it, type),
    typeLabel: exerciseTypeLabel(type),
    notes: it.notes,
    thumbUrl: it.exercise.catalog?.imageUrl ?? it.exercise.catalog?.gifUrl ?? null,
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

  const [assignment, t, memberSchemaMode, autoStopped] = await Promise.all([
    getAssignedSchema(member.id, member.tenantId),
    getTranslations("member.schema"),
    getMemberSchemaMode(member.tenantId),
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
  ]);
  const canBuild = memberSchemaMode !== "DISABLED";
  const schema = assignment?.template;
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
                  <Dumbbell className="size-4" /> Zelf samenstellen
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
  const days: ChecklistDay[] = schema.days.map((d) => ({
    name: d.name,
    notes: d.notes,
    items: d.items.map(toChecklistItem),
  }));
  const flatItems: ChecklistItem[] = schema.items.map(toChecklistItem);
  const multiDay = days.length > 1;
  // Per-dag startopties: je doet één trainingsdag per sessie.
  const dayOptions = schema.days.map((d) => ({
    id: d.id,
    name: d.name,
    count: d.items.length,
  }));

  return (
    <Fullscreenable className="flex flex-1 flex-col gap-5 px-5 py-8">
      {isNew ? <MarkSchemaSeen /> : null}
      {autoStopBanner}
      <div className="flex items-start justify-between gap-3">
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
        </div>
        <FullscreenButton />
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

      {schema.coachNote ? (
        <div className="rounded-2xl border border-border bg-surface-1 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {t("coachNote")}
          </p>
          <p className="mt-1 text-sm text-neutral-700">{schema.coachNote}</p>
        </div>
      ) : null}

      {multiDay ? (
        <SchemaChecklist days={days} />
      ) : (
        <SchemaChecklist items={flatItems} />
      )}

      {multiDay ? (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-sm font-semibold text-neutral-900">{t("chooseDay")}</p>
          {dayOptions.map((d) => (
            <form key={d.id} action={startSession}>
              <input type="hidden" name="dayId" value={d.id} />
              <button
                type="submit"
                className="flex w-full items-center justify-between gap-3 rounded-2xl bg-accent-gradient px-6 py-4 text-left font-bold text-accent-foreground shadow-accent transition-transform active:scale-[0.98]"
              >
                <span className="flex items-center gap-2 text-lg">
                  <Play className="size-5 fill-current" /> {d.name}
                </span>
                <span className="text-sm font-medium text-accent-foreground/80">
                  {t("exercisesCount", { count: d.count })}
                </span>
              </button>
            </form>
          ))}
        </div>
      ) : (
        <form action={startSession}>
          <button
            type="submit"
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-gradient px-6 py-5 text-center text-lg font-bold text-accent-foreground shadow-accent transition-transform active:scale-[0.98]"
          >
            <Play className="size-5 fill-current" /> {t("startTraining")}
          </button>
        </form>
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
    </Fullscreenable>
  );
}
