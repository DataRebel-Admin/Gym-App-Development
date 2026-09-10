import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { getLocationScope } from "@/lib/location-access";
import { locationScopeWhere } from "@/lib/location-scope";
import { areClassesEnabled } from "@/lib/classes";
import { ACTIVE_ENROLLMENT_STATUSES, attendanceOpen, sessionCapacity } from "@/lib/class-attendance";
import { dayKeyInTz } from "@/lib/metrics/definitions";
import { getClassBookingDefaults, toBookingDefaultsView } from "@/lib/class-booking";
import { listAvailableCoaches } from "@/lib/coach-assignments";
import { getTenantLocations } from "@/lib/locations";
import { formatSessionStart, formatTimeRange } from "@/lib/datetime";
import { NewClassForm } from "./class-forms";

export async function generateMetadata() {
  const t = await getTranslations("owner.rooster");
  return { title: t("metaTitle") };
}

export default async function RoosterPage() {
  const owner = await requirePermission("schedule:manage");
  if (!(await areClassesEnabled(owner.tenantId))) notFound();
  const t = await getTranslations("owner.rooster");
  // Vestiging-scope (fail-closed): een medewerker ziet alleen sessies op
  // gekoppelde vestigingen; de les-definities zelf zijn org-niveau.
  const scope = await getLocationScope(owner);
  const scoped = locationScopeWhere(owner.tenantId, scope);
  const multiLocation = (await getTenantLocations(owner.tenantId)).length > 1;

  const now = new Date();
  // "Vandaag" = van nu tot het einde van de dag op de klok van de vestiging.
  // De ruwe query pakt een marge van 36 uur (tijdzones lopen uiteen) en het
  // filteren op dagsleutel gebeurt daarna per sessie in de eigen zone —
  // servertijd is hier nooit de maatstaf (zie de tijdzone-regel in CLAUDE.md).
  const dayHorizon = new Date(now.getTime() + 36 * 3_600_000);

  const sessionInclude = {
    groupClass: { select: { id: true, name: true, maxParticipants: true, instructorName: true } },
    venueLocation: { select: { name: true, timezone: true } },
    instructor: { select: { name: true } },
    // Capaciteit telt alleen actieve statussen (lib/class-attendance.ts).
    _count: {
      select: {
        enrollments: { where: { status: { in: [...ACTIVE_ENROLLMENT_STATUSES] } } },
      },
    },
  } satisfies Prisma.ClassSessionInclude;

  const [classes, upcoming, todayRows, instructors, bookingDefaults] = await Promise.all([
    // Gearchiveerde lestypes blijven in deze lijst staan (achteraan, met
    // badge): anders is een archief niet meer terug te draaien.
    prisma.groupClass.findMany({
      where: { tenantId: owner.tenantId },
      orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
      include: { _count: { select: { sessions: { where: { ...scoped, startsAt: { gte: now } } } } } },
    }),
    prisma.classSession.findMany({
      where: { ...scoped, startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 25,
      include: sessionInclude,
    }),
    // Lessen van vandaag, inclusief de les die nu bezig is en de lessen die al
    // afgelopen zijn — juist dáár moet nog afgevinkt worden.
    prisma.classSession.findMany({
      where: {
        ...scoped,
        cancelledAt: null,
        startsAt: { gte: new Date(now.getTime() - 36 * 3_600_000), lte: dayHorizon },
      },
      orderBy: { startsAt: "asc" },
      include: sessionInclude,
    }),
    listAvailableCoaches(owner.tenantId),
    getClassBookingDefaults(owner.tenantId),
  ]);

  const today = todayRows.filter(
    (s) => dayKeyInTz(s.startsAt, s.venueLocation.timezone) === dayKeyInTz(now, s.venueLocation.timezone)
  );
  const instructorOptions = instructors.map((i) => ({ id: i.id, name: i.name ?? i.email }));
  const defaultsView = toBookingDefaultsView(bookingDefaults);

  return (
    <div className="flex flex-col gap-8 px-5 py-7 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{t("title")}</h1>
        <p className="text-sm text-neutral-500">{t("desc")}</p>
      </div>

      {/* Vandaag staat bovenaan: dat is de enige vraag die een medewerker 's
          ochtends heeft, en het is de ingang naar het aanwezigheidsscherm. */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">{t("todaySessions")}</h2>
        {today.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("noSessionsToday")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {today.map((s) => {
              const tz = s.venueLocation.timezone;
              const instructor = s.instructor?.name ?? s.groupClass.instructorName;
              const markable = attendanceOpen(s, now);
              return (
                <li key={s.id}>
                  <Link
                    href={`/owner/rooster/sessie/${s.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-1 px-4 py-3 text-sm hover:bg-surface-2"
                  >
                    <span className="min-w-0">
                      <span className="font-medium text-neutral-900">{s.groupClass.name}</span>{" "}
                      <span className="text-neutral-500">
                        · {formatTimeRange(s.startsAt, s.endsAt, tz)}
                        {multiLocation ? ` · ${s.venueLocation.name}` : ""}
                        {instructor ? ` · ${instructor}` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-neutral-500">
                      {s._count.enrollments}/{sessionCapacity(s)}
                      {markable ? (
                        <span className="rounded-md bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                          {t("attendanceLink")}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-1 p-5">
        <h2 className="text-sm font-semibold text-neutral-900">{t("newClass")}</h2>
        <NewClassForm instructors={instructorOptions} defaults={defaultsView} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">
          {t("groupClasses", { count: classes.length })}
        </h2>
        {classes.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("noClasses")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {classes.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/owner/rooster/${c.id}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface-1 px-4 py-3 hover:bg-surface-2"
                >
                  <span className="font-medium text-neutral-900">
                    {c.name}
                    {c.archivedAt !== null ? (
                      <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                        Gearchiveerd
                      </span>
                    ) : null}
                  </span>
                  <span className="text-sm text-neutral-500">
                    {t("sessionsMax", { count: c._count.sessions, max: c.maxParticipants })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">{t("upcomingSessions")}</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("nothingPlanned")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((s) => {
              const tz = s.venueLocation.timezone;
              return (
                <li key={s.id}>
                  <Link
                    href={`/owner/rooster/sessie/${s.id}`}
                    className="flex items-center justify-between rounded-xl border border-border bg-surface-1 px-4 py-3 text-sm hover:bg-surface-2"
                  >
                  <span>
                    <span className="font-medium text-neutral-900">{s.groupClass.name}</span>{" "}
                    <span className="text-neutral-500">
                      · {formatSessionStart(s.startsAt, tz)} ({formatTimeRange(s.startsAt, s.endsAt, tz)})
                    </span>
                    {s.cancelledAt !== null ? (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                        {t("cancelledBadge")}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-neutral-500">
                    {s._count.enrollments}/{sessionCapacity(s)}
                  </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
