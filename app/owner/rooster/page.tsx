import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { getLocationScope } from "@/lib/location-access";
import { locationScopeWhere } from "@/lib/location-scope";
import { areClassesEnabled } from "@/lib/classes";
import { ACTIVE_ENROLLMENT_STATUSES, sessionCapacity } from "@/lib/class-attendance";
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

  const [classes, upcoming] = await Promise.all([
    prisma.groupClass.findMany({
      where: { tenantId: owner.tenantId },
      orderBy: { name: "asc" },
      include: { _count: { select: { sessions: { where: { ...scoped, startsAt: { gte: new Date() } } } } } },
    }),
    prisma.classSession.findMany({
      where: { ...scoped, startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 25,
      include: {
        groupClass: { select: { name: true, maxParticipants: true } },
        venueLocation: { select: { timezone: true } },
        // Capaciteit telt alleen actieve statussen (lib/class-attendance.ts).
        _count: {
          select: {
            enrollments: { where: { status: { in: [...ACTIVE_ENROLLMENT_STATUSES] } } },
          },
        },
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{t("title")}</h1>
        <p className="text-sm text-neutral-500">{t("desc")}</p>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-5">
        <h2 className="text-sm font-semibold text-neutral-900">{t("newClass")}</h2>
        <NewClassForm />
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
                  className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 hover:bg-neutral-50"
                >
                  <span className="font-medium text-neutral-900">{c.name}</span>
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
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 text-sm"
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
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
