import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { getLocationScope } from "@/lib/location-access";
import { canAccessLocation } from "@/lib/location-scope";
import { areClassesEnabled } from "@/lib/classes";
import {
  ATTENDANCE_LEAD_MINUTES,
  ACTIVE_ENROLLMENT_STATUSES,
  attendanceOpen,
  sessionCapacity,
} from "@/lib/class-attendance";
import { formatSessionStart, formatTimeRange } from "@/lib/datetime";
import { getTenantLocations } from "@/lib/locations";
import { AttendancePanel, type AttendanceRow } from "@/components/classes/attendance-panel";

/**
 * Eén lessessie: het scherm waar een trainer in de zaal aanwezigheid afvinkt.
 *
 * Bewust een eigen route naast `/owner/rooster/[id]` (dat is het **lestype**).
 * De aanwezigheidslijst zat eerder weggestopt onder "Afgelopen sessies" op de
 * lestype-pagina, met per deelnemer een formulier dat de hele pagina herlaadde.
 *
 * UI hardcoded NL (precedent onderhoud/defecten/inzichten in de owner-area).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const owner = await requirePermission("schedule:manage");
  const session = await prisma.classSession.findFirst({
    where: { id, tenantId: owner.tenantId },
    select: { groupClass: { select: { name: true } } },
  });
  return { title: session ? `${session.groupClass.name} | Lessessie` : "Lessessie" };
}

export default async function ClassSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requirePermission("schedule:manage");
  if (!(await areClassesEnabled(owner.tenantId))) notFound();

  const session = await prisma.classSession.findFirst({
    where: { id, tenantId: owner.tenantId },
    include: {
      groupClass: { select: { id: true, name: true, maxParticipants: true, instructorName: true } },
      venueLocation: { select: { name: true, timezone: true } },
      instructor: { select: { name: true, email: true } },
      enrollments: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { enrolledAt: "asc" },
        select: {
          id: true,
          status: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!session) notFound();
  // Vestiging-scope, fail-closed zoals overal in de rooster-module.
  const scope = await getLocationScope(owner);
  if (!canAccessLocation(scope, session.locationId)) notFound();

  const locations = await getTenantLocations(owner.tenantId);
  const multiLocation = locations.length > 1;
  const now = new Date();
  const tz = session.venueLocation.timezone;

  const participants = session.enrollments.filter((e) => e.status !== "WAITLISTED");
  const waiting = session.enrollments.filter((e) => e.status === "WAITLISTED");
  const rows: AttendanceRow[] = participants.map((e) => ({
    enrollmentId: e.id,
    name: e.user.name ?? e.user.email,
    // CANCELLED en WAITLISTED zitten hier al niet meer in.
    status: e.status as AttendanceRow["status"],
  }));

  const capacity = sessionCapacity(session);
  const active = participants.filter((e) =>
    (ACTIVE_ENROLLMENT_STATUSES as readonly string[]).includes(e.status)
  ).length;
  const isCancelled = session.cancelledAt !== null;
  const canMark = !isCancelled && attendanceOpen(session, now);
  const closedReason = isCancelled
    ? "Deze les is geannuleerd, aanwezigheid afvinken kan niet."
    : `Afvinken kan vanaf ${ATTENDANCE_LEAD_MINUTES} minuten vóór de start.`;
  const instructor = session.instructor?.name ?? session.groupClass.instructorName;

  return (
    <div className="flex flex-col gap-8 px-5 py-7 sm:px-6 sm:py-8">
      <div>
        <Link
          href={`/owner/rooster/${session.groupClass.id}`}
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← {session.groupClass.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
          <span className="capitalize">{formatSessionStart(session.startsAt, tz)}</span>
          {isCancelled ? (
            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 align-middle text-[11px] font-semibold uppercase tracking-wide text-red-700">
              Geannuleerd
            </span>
          ) : null}
        </h1>
        <p className="text-sm text-neutral-500">
          {formatTimeRange(session.startsAt, session.endsAt, tz)}
          {multiLocation ? ` · ${session.venueLocation.name}` : ""}
          {session.location ? ` · ${session.location}` : ""}
          {instructor ? ` · ${instructor}` : ""}
          {` · ${active}/${capacity} bezet`}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-neutral-900">Aanwezigheid</h2>
        <AttendancePanel
          sessionId={session.id}
          rows={rows}
          open={canMark}
          closedReason={closedReason}
        />
      </section>

      {waiting.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">
            Wachtlijst ({waiting.length})
          </h2>
          <ul className="flex flex-col divide-y divide-neutral-100 overflow-hidden rounded-xl border border-border bg-surface-1">
            {waiting.map((e, i) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-5 shrink-0 text-neutral-400">{i + 1}.</span>
                <span className="min-w-0 truncate text-neutral-700">{e.user.name ?? e.user.email}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-neutral-500">
            Wachtenden schuiven automatisch door zodra er een plek vrijkomt, tot een uur vóór de
            start.
          </p>
        </section>
      ) : null}
    </div>
  );
}
