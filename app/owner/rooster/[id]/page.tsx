import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { requirePermission } from "@/lib/staff";
import { getLocationScope } from "@/lib/location-access";
import { canAccessLocation, locationScopeWhere } from "@/lib/location-scope";
import { areClassesEnabled } from "@/lib/classes";
import {
  ACTIVE_ENROLLMENT_STATUSES,
  ENROLLMENT_STATUS_META,
  attendanceOpen,
  canDeleteSession,
  sessionCapacity,
} from "@/lib/class-attendance";
import { getTenantLocations } from "@/lib/locations";
import { resolveActiveLocationId } from "@/lib/location-resolve";
import { formatSessionStart, formatTimeRange } from "@/lib/datetime";
import { dateToZonedInput } from "@/lib/tz";
import { getClassBookingDefaults, toBookingDefaultsView } from "@/lib/class-booking";
import { listAvailableCoaches } from "@/lib/coach-assignments";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { AddSessionForm, ClassImageForm, EditClassForm, EditSessionForm } from "../class-forms";
import { SessionCancelButton, SessionDeleteButton } from "../session-delete-button";
import { deleteClass, restoreSession, setClassArchived } from "../actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("owner.rooster");
  const tenant = await getCurrentTenant();
  const groupClass = tenant
    ? await prisma.groupClass.findFirst({ where: { id, tenantId: tenant.id }, select: { name: true } })
    : null;
  return { title: groupClass ? `${groupClass.name} | ${t("metaTitle")}` : t("metaTitle") };
}

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requirePermission("schedule:manage");
  if (!(await areClassesEnabled(owner.tenantId))) notFound();
  const t = await getTranslations("owner.rooster");
  const scope = await getLocationScope(owner);
  const scoped = locationScopeWhere(owner.tenantId, scope);

  const groupClass = await prisma.groupClass.findFirst({
    where: { id, tenantId: owner.tenantId },
    include: {
      sessions: {
        // Vestiging-scope (fail-closed): alleen sessies op toegankelijke vestigingen.
        where: scoped,
        orderBy: { startsAt: "asc" },
        include: {
          venueLocation: { select: { name: true, timezone: true } },
          // Capaciteit telt alleen actieve statussen (lib/class-attendance.ts).
          _count: {
            select: {
              enrollments: { where: { status: { in: [...ACTIVE_ENROLLMENT_STATUSES] } } },
            },
          },
          // Deelnemers + wachtlijst (afgemeld blijft verborgen).
          enrollments: {
            where: { status: { not: "CANCELLED" } },
            orderBy: { enrolledAt: "asc" },
            select: { id: true, status: true, user: { select: { name: true, email: true } } },
          },
        },
      },
    },
  });
  if (!groupClass) notFound();

  const [allLocations, activeLocationId, instructors, bookingDefaults, tenant] = await Promise.all([
    getTenantLocations(owner.tenantId),
    resolveActiveLocationId(owner.tenantId),
    listAvailableCoaches(owner.tenantId),
    getClassBookingDefaults(owner.tenantId),
    prisma.tenant.findUnique({ where: { id: owner.tenantId }, select: { logoUrl: true } }),
  ]);
  const instructorOptions = instructors.map((i) => ({ id: i.id, name: i.name ?? i.email }));
  const defaultsView = toBookingDefaultsView(bookingDefaults);
  // Alleen vestigingen waar deze gebruiker mag plannen.
  const locations = allLocations
    .filter((l) => canAccessLocation(scope, l.id))
    .map((l) => ({ id: l.id, name: l.name }));
  const multiLocation = allLocations.length > 1;
  const defaultLocationId = locations.some((l) => l.id === activeLocationId)
    ? activeLocationId
    : (locations[0]?.id ?? activeLocationId);
  const now = new Date();
  const upcoming = groupClass.sessions.filter((s) => s.endsAt >= now);
  const past = groupClass.sessions.filter((s) => s.endsAt < now).reverse();
  const isArchived = groupClass.archivedAt !== null;

  const badgeClass = (tone: string) =>
    tone === "positive"
      ? "bg-green-100 text-green-700"
      : tone === "negative"
        ? "bg-red-100 text-red-700"
        : tone === "info"
          ? "bg-sky-100 text-sky-800"
          : "bg-surface-2 text-neutral-500";

  const renderSession = (s: (typeof groupClass.sessions)[number], isPast: boolean) => {
    const tz = s.venueLocation.timezone;
    const waiting = s.enrollments.filter((e) => e.status === "WAITLISTED").length;
    const participants = s.enrollments.filter((e) => e.status !== "WAITLISTED");
    const isCancelled = s.cancelledAt !== null;
    // Zelfde regel als de server-action (lib/class-attendance.ts) — anders
    // toont de knop gevallen die de action stil weigert.
    const canDelete = canDeleteSession(s, s.enrollments.length, now);
    return (
      <li key={s.id} className="flex flex-col gap-2 rounded-xl border border-border bg-surface-1 px-4 py-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span>
            <span className={`font-medium ${isCancelled ? "text-neutral-400 line-through" : "text-neutral-900"}`}>
              {formatSessionStart(s.startsAt, tz)}
            </span>{" "}
            <span className="text-neutral-500">
              ({formatTimeRange(s.startsAt, s.endsAt, tz)})
              {multiLocation ? ` · ${s.venueLocation.name}` : ""}
              {s.location ? ` · ${s.location}` : ""}
            </span>
            {isCancelled ? (
              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                {t("cancelledBadge")}
              </span>
            ) : null}
          </span>
          <span className="flex items-center gap-3">
            <span className="text-neutral-500">
              {s._count.enrollments}/{sessionCapacity({ maxParticipants: s.maxParticipants, groupClass })}
              {waiting > 0 ? (
                <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                  {t("waitlist", { count: waiting })}
                </span>
              ) : null}
            </span>
            {!isPast && !isCancelled ? (
              <SessionCancelButton sessionId={s.id} classId={groupClass.id} inSeries={s.seriesId !== null} />
            ) : null}
            {canDelete ? (
              <SessionDeleteButton sessionId={s.id} classId={groupClass.id} inSeries={s.seriesId !== null} />
            ) : null}
          </span>
        </div>

        {!isPast && isCancelled ? (
          <form action={restoreSession}>
            <input type="hidden" name="id" value={s.id} />
            <input type="hidden" name="classId" value={groupClass.id} />
            <button className="text-xs text-accent hover:underline">{t("restoreSession")}</button>
          </form>
        ) : null}

        {!isPast && !isCancelled ? (
          <details className="group">
            <summary className="cursor-pointer text-xs text-accent hover:underline">{t("editSession")}</summary>
            <div className="mt-3">
              <EditSessionForm
                classId={groupClass.id}
                locations={locations}
                inSeries={s.seriesId !== null}
                instructors={instructorOptions}
                values={{
                  id: s.id,
                  startsAt: dateToZonedInput(s.startsAt, tz),
                  endsAt: dateToZonedInput(s.endsAt, tz),
                  locationId: s.locationId,
                  location: s.location,
                  maxParticipants: s.maxParticipants,
                  instructorId: s.instructorId,
                }}
              />
            </div>
          </details>
        ) : null}

        {/* Aanwezigheid heeft een eigen scherm per sessie: dat is wat een
            trainer met een telefoon in de zaal opent. Hier alleen de stand +
            de ingang, geen twintig losse formulieren. */}
        {s.enrollments.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2">
            <p className="min-w-0 flex-1 truncate text-xs text-neutral-500">
              {participants
                .map((e) => e.user.name ?? e.user.email)
                .concat(
                  waiting > 0
                    ? [`+${waiting} ${ENROLLMENT_STATUS_META.WAITLISTED.label.toLowerCase()}`]
                    : []
                )
                .join(", ")}
            </p>
            {attendanceOpen(s, now) && !isCancelled ? (
              <Link
                href={`/owner/rooster/sessie/${s.id}`}
                className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-surface-2"
              >
                {t("attendanceLink")}
              </Link>
            ) : null}
          </div>
        ) : null}
        {isPast && participants.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {participants.map((e) => {
              const meta = ENROLLMENT_STATUS_META[e.status];
              return (
                <span
                  key={e.id}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClass(meta.tone)}`}
                >
                  {meta.label}
                </span>
              );
            })}
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <Link href="/owner/rooster" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← {t("back")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{groupClass.name}</h1>
        <p className="text-sm text-neutral-500">
          {groupClass.instructorName ? `${groupClass.instructorName} · ` : ""}
          {t("maxParticipantsLine", { max: groupClass.maxParticipants })}
        </p>
        {groupClass.description ? (
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">{groupClass.description}</p>
        ) : null}
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-1 p-5">
        <h2 className="text-sm font-semibold text-neutral-900">{t("planSession")}</h2>
        {locations.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("locationNotAllowed")}</p>
        ) : (
          <AddSessionForm
            classId={groupClass.id}
            locations={locations}
            defaultLocationId={defaultLocationId}
            instructors={instructorOptions}
          />
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">{t("sessions", { count: upcoming.length })}</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("noSessions")}</p>
        ) : (
          <ul className="flex flex-col gap-2">{upcoming.map((s) => renderSession(s, false))}</ul>
        )}
      </section>

      {past.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">{t("pastSessions")}</h2>
          <ul className="flex flex-col gap-2">{past.map((s) => renderSession(s, true))}</ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-1 p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Afbeelding</h2>
        <ClassImageForm
          classId={groupClass.id}
          imageUrl={groupClass.imageUrl}
          fallbackUrl={tenant?.logoUrl ?? null}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-1 p-5">
        <h2 className="text-sm font-semibold text-neutral-900">{t("editClass")}</h2>
        <EditClassForm
          instructors={instructorOptions}
          defaults={defaultsView}
          values={{
            id: groupClass.id,
            name: groupClass.name,
            description: groupClass.description,
            instructorName: groupClass.instructorName,
            maxParticipants: groupClass.maxParticipants,
            defaultInstructorId: groupClass.defaultInstructorId,
            cancelDeadlineMinutes: groupClass.cancelDeadlineMinutes,
            bookingOpensDays: groupClass.bookingOpensDays,
            maxBookingsPerWeek: groupClass.maxBookingsPerWeek,
            remindHoursBefore: groupClass.remindHoursBefore,
          }}
        />
      </section>

      {/* Archiveren staat vóór verwijderen: dit is bijna altijd wat een
          sportschool bedoelt met "we stoppen hiermee". Verwijderen cascadeert
          de aanwezigheidshistorie weg. */}
      <section className="flex max-w-2xl flex-col gap-3 rounded-xl border border-border bg-surface-1 p-5">
        <h2 className="text-sm font-semibold text-neutral-900">
          {isArchived ? "Uit het archief halen" : "Archiveren"}
        </h2>
        <p className="text-sm text-neutral-500">
          {isArchived
            ? "Dit lestype staat in het archief: leden zien het niet en er kan niet op geboekt worden. Sessies en aanwezigheidshistorie zijn bewaard gebleven."
            : "Haalt het lestype uit het aanbod. Komende sessies worden geannuleerd en aangemelde leden krijgen bericht; sessies en aanwezigheidshistorie blijven bewaard."}
        </p>
        <div>
          <ConfirmButton
            action={setClassArchived}
            fields={{ id: groupClass.id, archived: isArchived ? "0" : "1" }}
            label={isArchived ? "Terugzetten" : "Archiveren"}
            title={isArchived ? "Lestype terugzetten" : "Lestype archiveren"}
            message={
              isArchived
                ? "Het lestype komt weer in het aanbod. Geannuleerde sessies blijven geannuleerd."
                : `Weet je zeker dat je '${groupClass.name}' archiveert? Komende sessies worden geannuleerd en de aangemelde leden krijgen bericht.`
            }
            triggerClassName="rounded-lg border border-border px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-surface-2"
          />
        </div>
      </section>

      <section className="flex max-w-2xl flex-col gap-3 rounded-xl border border-red-200 bg-surface-1 p-5">
        <h2 className="text-sm font-semibold text-red-700">{t("deleteClass")}</h2>
        <p className="text-sm text-neutral-500">{t("deleteClassDesc")}</p>
        <div>
          <ConfirmButton
            action={deleteClass}
            fields={{ id: groupClass.id }}
            label={t("deleteClass")}
            title={t("deleteClass")}
            message={t("deleteClassConfirm")}
            triggerClassName="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          />
        </div>
      </section>
    </div>
  );
}
