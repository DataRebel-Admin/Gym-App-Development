import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { requirePermission } from "@/lib/staff";
import { areClassesEnabled } from "@/lib/classes";
import { ACTIVE_ENROLLMENT_STATUSES, ENROLLMENT_STATUS_META } from "@/lib/class-attendance";
import { getTenantLocations } from "@/lib/locations";
import { resolveActiveLocationId } from "@/lib/location-resolve";
import { formatSessionStart, formatTimeRange } from "@/lib/datetime";
import { AddSessionForm } from "../class-forms";
import { deleteClass, deleteSession, markAttendance } from "../actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  const groupClass = tenant
    ? await prisma.groupClass.findFirst({
        where: { id, tenantId: tenant.id },
        select: { name: true },
      })
    : null;
  return { title: groupClass ? `${groupClass.name} | Les` : "Les" };
}

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const owner = await requirePermission("schedule:manage");
  if (!(await areClassesEnabled(owner.tenantId))) notFound();

  const groupClass = await prisma.groupClass.findFirst({
    where: { id, tenantId: owner.tenantId },
    include: {
      sessions: {
        orderBy: { startsAt: "asc" },
        // Capaciteit telt alleen actieve statussen (lib/class-attendance.ts).
        include: {
          venueLocation: { select: { name: true } },
          _count: {
            select: { enrollments: { where: { status: { in: [...ACTIVE_ENROLLMENT_STATUSES] } } } },
          },
          // Deelnemers voor het aanwezigheidspaneel (afgemeld blijft verborgen).
          enrollments: {
            where: { status: { not: "CANCELLED" } },
            orderBy: { enrolledAt: "asc" },
            select: {
              id: true,
              status: true,
              user: { select: { name: true, email: true } },
            },
          },
        },
      },
    },
  });
  if (!groupClass) notFound();

  const [locations, activeLocationId] = await Promise.all([
    getTenantLocations(owner.tenantId),
    resolveActiveLocationId(owner.tenantId),
  ]);
  const multiLocation = locations.length > 1;
  const now = new Date();

  return (
    <div className="flex flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <Link
          href="/owner/rooster"
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Rooster
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
          {groupClass.name}
        </h1>
        <p className="text-sm text-neutral-500">
          {groupClass.instructorName ? `${groupClass.instructorName} · ` : ""}
          max {groupClass.maxParticipants} deelnemers
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Sessie inplannen</h2>
        <AddSessionForm
          classId={groupClass.id}
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
          defaultLocationId={activeLocationId}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">
          Sessies ({groupClass.sessions.length})
        </h2>
        {groupClass.sessions.length === 0 ? (
          <p className="text-sm text-neutral-500">Nog geen sessies ingepland.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {groupClass.sessions.map((s) => {
              const isPast = s.endsAt < now;
              return (
                <li
                  key={s.id}
                  className="flex flex-col gap-2 rounded-xl border border-neutral-200 px-4 py-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span>
                      <span className="font-medium text-neutral-900">
                        {formatSessionStart(s.startsAt)}
                      </span>{" "}
                      <span className="text-neutral-500">
                        ({formatTimeRange(s.startsAt, s.endsAt)})
                        {multiLocation ? ` · ${s.venueLocation.name}` : ""}
                        {s.location ? ` · ${s.location}` : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-neutral-500">
                        {s._count.enrollments}/{groupClass.maxParticipants}
                      </span>
                      <form action={deleteSession}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="classId" value={groupClass.id} />
                        <button
                          type="submit"
                          className="text-neutral-400 hover:text-red-600"
                          aria-label="Verwijder sessie"
                        >
                          ✕
                        </button>
                      </form>
                    </span>
                  </div>

                  {/* Aanwezigheid: ná de les markeert staff wie er was; wat op
                      ENROLLED blijft staan wordt 12u later automatisch NO_SHOW
                      (cron). Afgemelde deelnemers staan hier bewust niet. */}
                  {isPast && s.enrollments.length > 0 ? (
                    <div className="flex flex-col gap-1 border-t border-neutral-100 pt-2">
                      {s.enrollments.map((e) => {
                        const meta = ENROLLMENT_STATUS_META[e.status];
                        return (
                          <div key={e.id} className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate text-neutral-700">
                              {e.user.name ?? e.user.email}
                              <span
                                className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                  meta.tone === "positive"
                                    ? "bg-green-100 text-green-700"
                                    : meta.tone === "negative"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-surface-2 text-neutral-500"
                                }`}
                              >
                                {meta.label}
                              </span>
                            </span>
                            <span className="flex shrink-0 gap-1">
                              {e.status !== "ATTENDED" ? (
                                <form action={markAttendance}>
                                  <input type="hidden" name="enrollmentId" value={e.id} />
                                  <input type="hidden" name="status" value="ATTENDED" />
                                  <button className="rounded-md border border-border px-2 py-1 text-xs text-neutral-600 hover:bg-surface-2">
                                    Aanwezig
                                  </button>
                                </form>
                              ) : null}
                              {e.status !== "NO_SHOW" ? (
                                <form action={markAttendance}>
                                  <input type="hidden" name="enrollmentId" value={e.id} />
                                  <input type="hidden" name="status" value="NO_SHOW" />
                                  <button className="rounded-md border border-border px-2 py-1 text-xs text-neutral-600 hover:bg-surface-2">
                                    No-show
                                  </button>
                                </form>
                              ) : null}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex max-w-2xl flex-col gap-3 rounded-xl border border-red-200 p-5">
        <h2 className="text-sm font-semibold text-red-700">Verwijderen</h2>
        <p className="text-sm text-neutral-500">
          Dit verwijdert de les en alle sessies + aanmeldingen.
        </p>
        <form action={deleteClass}>
          <input type="hidden" name="id" value={groupClass.id} />
          <button
            type="submit"
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Les verwijderen
          </button>
        </form>
      </section>
    </div>
  );
}
