import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import type { EnrollmentStatus, Prisma } from "@prisma/client";
import { requireMember } from "@/lib/member";
import { areClassesEnabled } from "@/lib/classes";
import {
  ACTIVE_ENROLLMENT_STATUSES,
  cancelWindowOpen,
  enrollWindowState,
  enrollmentWindowOpen,
  resolveBookingRules,
  sessionCapacity,
} from "@/lib/class-attendance";
import { BOOKING_OVERRIDE_SELECT, getClassBookingDefaults } from "@/lib/class-booking";
import { classImage } from "@/lib/class-image";
import { getTenantLocations } from "@/lib/locations";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { ClassCard, type SessionCard } from "@/components/classes/class-card";
import { CalendarDays, ChevronRight, Users } from "@/components/ui/icons";

/**
 * Eén lestype voor het lid: waar de les over gaat, wie hem geeft, wat de
 * regels zijn en wanneer hij komt.
 *
 * De omschrijving zat alleen achter een info-knop op de kaart; bij een les die
 * vol raakt wil je juist kunnen kiezen, en dat vraagt om meer dan een tooltip.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ classId: string }>;
}): Promise<Metadata> {
  const { classId } = await params;
  const member = await requireMember();
  const groupClass = await prisma.groupClass.findFirst({
    where: { id: classId, tenantId: member.tenantId },
    select: { name: true },
  });
  return { title: groupClass?.name ?? "Les" };
}

export default async function MemberClassTypePage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const member = await requireMember();
  if (!(await areClassesEnabled(member.tenantId))) notFound();
  const t = await getTranslations("member.rooster");

  const now = new Date();
  const MINE_STATUSES: EnrollmentStatus[] = ["ENROLLED", "WAITLISTED"];
  const sessionInclude = {
    groupClass: {
      select: {
        name: true,
        description: true,
        instructorName: true,
        maxParticipants: true,
        ...BOOKING_OVERRIDE_SELECT,
        defaultInstructor: { select: { name: true } },
      },
    },
    instructor: { select: { name: true } },
    venueLocation: { select: { name: true, timezone: true } },
    _count: {
      select: { enrollments: { where: { status: { in: [...ACTIVE_ENROLLMENT_STATUSES] } } } },
    },
    enrollments: {
      where: { status: { in: MINE_STATUSES } },
      orderBy: { enrolledAt: "asc" },
      select: { userId: true, status: true },
    },
  } satisfies Prisma.ClassSessionInclude;

  const [groupClass, locations, bookingDefaults, tenant] = await Promise.all([
    prisma.groupClass.findFirst({
      where: { id: classId, tenantId: member.tenantId, archivedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        instructorName: true,
        ...BOOKING_OVERRIDE_SELECT,
        defaultInstructor: { select: { name: true } },
        sessions: {
          where: { endsAt: { gte: now }, cancelledAt: null },
          orderBy: { startsAt: "asc" },
          take: 20,
          include: sessionInclude,
        },
      },
    }),
    getTenantLocations(member.tenantId),
    getClassBookingDefaults(member.tenantId),
    prisma.tenant.findUnique({
      where: { id: member.tenantId },
      select: { logoUrl: true },
    }),
  ]);
  if (!groupClass) notFound();

  const multiLocation = locations.length > 1;
  const rules = resolveBookingRules(groupClass, bookingDefaults);
  const cover = classImage(groupClass, { logoUrl: tenant?.logoUrl ?? null });
  const instructor = groupClass.defaultInstructor?.name ?? groupClass.instructorName;

  const cards: SessionCard[] = groupClass.sessions.map((s) => {
    const waiting = s.enrollments.filter((e) => e.status === "WAITLISTED");
    const own = s.enrollments.find((e) => e.userId === member.id);
    const max = sessionCapacity(s);
    const count = s._count.enrollments;
    const sessionRules = resolveBookingRules(s.groupClass, bookingDefaults);
    const mine = own ? (own.status === "ENROLLED" ? "enrolled" : "waitlisted") : null;
    return {
      id: s.id,
      classId: s.classId,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      timezone: s.venueLocation.timezone,
      locationId: s.locationId,
      venueName: multiLocation ? s.venueLocation.name : null,
      location: s.location,
      className: s.groupClass.name,
      // De omschrijving staat al bovenaan deze pagina; op de kaart eronder zou
      // de info-knop hem een tweede keer aanbieden.
      description: null,
      instructorName:
        s.instructor?.name ?? s.groupClass.defaultInstructor?.name ?? s.groupClass.instructorName,
      cancelled: false,
      past: false,
      mine,
      waitlistPosition:
        own?.status === "WAITLISTED" ? waiting.findIndex((e) => e.userId === member.id) + 1 : null,
      waitlistCount: waiting.length,
      full: count >= max,
      started: !enrollmentWindowOpen(s, now),
      tooEarly: enrollWindowState(s, now, sessionRules) === "tooEarly",
      canCancel:
        mine === "waitlisted"
          ? enrollmentWindowOpen(s, now)
          : cancelWindowOpen(s, now, sessionRules),
      cancelDeadlineMinutes: sessionRules.cancelDeadlineMinutes,
      spotsLeft: Math.max(0, max - count),
      count,
      max,
    };
  });

  return (
    <Reveal stagger className="flex flex-1 flex-col gap-6 px-5 py-8">
      <RevealItem className="flex flex-col gap-3">
        <Link
          href="/member/rooster"
          className="inline-flex items-center gap-1 text-sm text-neutral-500"
        >
          ← {t("backToClasses")}
        </Link>

        <div className="overflow-hidden rounded-2xl border border-border bg-accent-soft">
          <div className="flex h-40 items-center justify-center">
            {cover ? (
              // Rauwe img: zonder Blob-token levert de upload lokaal een
              // data-URL op en die kan de optimizer niet aan (zelfde afweging
              // als de schema-omslagfoto).
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover.url}
                alt={cover.alt}
                className={
                  cover.kind === "photo" ? "size-full object-cover" : "max-h-24 object-contain p-4"
                }
              />
            ) : (
              <Users className="size-10 text-accent" />
            )}
          </div>
        </div>

        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
            {groupClass.name}
          </h1>
          {instructor ? (
            <p className="mt-1 text-sm text-neutral-500">
              {t("instructorLabel")}: {instructor}
            </p>
          ) : null}
        </div>

        {groupClass.description ? (
          <div>
            <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              {t("aboutClass")}
            </h2>
            <p className="mt-1.5 whitespace-pre-line text-sm text-neutral-600">
              {groupClass.description}
            </p>
          </div>
        ) : null}
      </RevealItem>

      {/* Regels die het lid raken. Alleen tonen wat écht een beperking is:
          "onbeperkt" en "tot de start" zijn geen mededeling waard. */}
      {rules.cancelDeadlineMinutes > 0 || rules.maxBookingsPerWeek !== null ? (
        <RevealItem className="flex flex-col gap-1.5 rounded-2xl border border-border bg-surface-1 p-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            {t("bookingRules")}
          </h2>
          <ul className="flex flex-col gap-1 text-sm text-neutral-600">
            {rules.cancelDeadlineMinutes > 0 ? (
              <li>
                {t("cancelUntil", {
                  time:
                    rules.cancelDeadlineMinutes >= 60
                      ? `${Math.round(rules.cancelDeadlineMinutes / 60)} uur`
                      : `${rules.cancelDeadlineMinutes} min`,
                })}
              </li>
            ) : null}
            {rules.maxBookingsPerWeek !== null ? (
              <li>{t("weekLimitHint", { count: rules.maxBookingsPerWeek })}</li>
            ) : null}
          </ul>
        </RevealItem>
      ) : null}

      <RevealItem className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          {t("nextSessions")}
        </h2>
        {cards.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface-1 px-4 py-6 text-center text-sm text-neutral-500">
            {t("noUpcomingSessions")}
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {cards.map((s) => (
              <ClassCard key={s.id} s={s} q={`type=${groupClass.id}`} />
            ))}
          </div>
        )}
        <Link
          href={`/member/rooster?type=${groupClass.id}`}
          className="inline-flex items-center gap-1 self-start text-sm font-semibold text-accent"
        >
          <CalendarDays className="size-4" />
          {t("title")}
          <ChevronRight className="size-3.5" />
        </Link>
      </RevealItem>
    </Reveal>
  );
}
