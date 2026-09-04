import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { requireMember } from "@/lib/member";
import { areClassesEnabled } from "@/lib/classes";
import Link from "next/link";
import { prisma } from "@/lib/db";
import type { EnrollmentStatus, Prisma } from "@prisma/client";
import {
  ACTIVE_ENROLLMENT_STATUSES,
  ROSTER_HORIZON_DAYS,
  enrollmentWindowOpen,
  sessionCapacity,
} from "@/lib/class-attendance";
import { getTenantLocations } from "@/lib/locations";
import { resolveActiveLocationId } from "@/lib/location-resolve";
import { formatSessionStart, formatTimeRange } from "@/lib/datetime";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarDays, Clock, MapPin, Users, Check } from "@/components/ui/icons";
import { enroll, unenroll, type RoosterMessage } from "./actions";

export async function generateMetadata() {
  const t = await getTranslations("member.rooster");
  return { title: t("metaTitle") };
}

type SessionCard = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  locationId: string;
  /** Vestiging-naam (alleen gezet bij een multi-vestiging-organisatie). */
  venueName: string | null;
  location: string | null;
  className: string;
  description: string | null;
  instructorName: string | null;
  /** Eigen status: aangemeld, op de wachtlijst (met positie) of niets. */
  mine: "enrolled" | "waitlisted" | null;
  waitlistPosition: number | null;
  waitlistCount: number;
  full: boolean;
  started: boolean;
  /** Geannuleerd door de sportschool: zichtbaar als mededeling, geen acties. */
  cancelled: boolean;
  spotsLeft: number;
  count: number;
  max: number;
};

const MESSAGES: Record<RoosterMessage, string> = {
  enrolled: "msgEnrolled",
  waitlisted: "msgWaitlisted",
  closed: "msgClosed",
  unchanged: "msgUnchanged",
  unenrolled: "msgUnenrolled",
};

function ClassCard({ s }: { s: SessionCard }) {
  const t = useTranslations("member.rooster");
  const highlighted = s.mine !== null;
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        highlighted ? "border-accent ring-1 ring-accent/20 bg-accent-soft" : "border-border bg-surface-1"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-neutral-900">{s.className}</p>
          {s.instructorName ? (
            <p className="text-xs text-neutral-500">{t("withInstructor", { name: s.instructorName })}</p>
          ) : null}
        </div>
        {s.cancelled ? (
          <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-700">
            {t("cancelled")}
          </span>
        ) : s.mine === "enrolled" ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-foreground">
            <Check className="size-3" /> {t("enrolled")}
          </span>
        ) : s.mine === "waitlisted" ? (
          <span className="shrink-0 rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-800">
            {s.waitlistPosition ? t("waitlistPosition", { position: s.waitlistPosition }) : t("waitlisted")}
          </span>
        ) : s.started ? (
          <span className="shrink-0 rounded-full bg-neutral-200 px-2.5 py-1 text-[11px] font-semibold text-neutral-500">
            {t("started")}
          </span>
        ) : s.full ? (
          <span className="shrink-0 rounded-full bg-neutral-200 px-2.5 py-1 text-[11px] font-semibold text-neutral-500">
            {t("full")}
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
            <Users className="size-3" /> {t("spotsLeft", { count: s.spotsLeft })}
          </span>
        )}
      </div>

      {s.description ? (
        <p className="mt-2 text-sm text-neutral-600">{s.description}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-neutral-600">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-4 text-accent" />
          <span className="capitalize">{formatSessionStart(s.startsAt, s.timezone)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-4 text-accent" />
          {formatTimeRange(s.startsAt, s.endsAt, s.timezone)}
        </span>
        {s.venueName || s.location ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4 text-accent" />
            {[s.venueName, s.location].filter(Boolean).join(" · ")}
          </span>
        ) : null}
        {s.full && s.waitlistCount > 0 && s.mine === null ? (
          <span className="text-xs text-neutral-500">{t("waitlistCount", { count: s.waitlistCount })}</span>
        ) : null}
      </div>

      <div className="mt-3.5">
        {s.cancelled ? null : s.mine !== null ? (
          s.started ? null : (
            <form action={unenroll}>
              <input type="hidden" name="sessionId" value={s.id} />
              <button
                type="submit"
                className="w-full rounded-xl border border-border bg-surface-1 px-4 py-2.5 text-sm font-semibold text-neutral-700 active:bg-surface-2"
              >
                {s.mine === "waitlisted" ? t("leaveWaitlist") : t("unenroll")}
              </button>
            </form>
          )
        ) : s.started ? (
          <button
            type="button"
            disabled
            className="w-full rounded-xl bg-surface-2 px-4 py-2.5 text-sm font-semibold text-neutral-400"
          >
            {t("started")}
          </button>
        ) : (
          <form action={enroll}>
            <input type="hidden" name="sessionId" value={s.id} />
            <button
              type="submit"
              className={`w-full rounded-xl px-4 py-2.5 text-sm font-bold active:opacity-90 ${
                s.full
                  ? "border border-accent bg-surface-1 text-accent"
                  : "bg-accent text-accent-foreground"
              }`}
            >
              {s.full ? t("joinWaitlist") : t("enroll")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default async function MemberRoosterPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string; msg?: string; overlap?: string }>;
}) {
  const member = await requireMember();
  if (!(await areClassesEnabled(member.tenantId))) notFound();
  const t = await getTranslations("member.rooster");
  const { loc, msg, overlap } = await searchParams;
  const now = new Date();

  const [locations, me] = await Promise.all([
    getTenantLocations(member.tenantId),
    prisma.user.findFirst({
      where: { id: member.id, tenantId: member.tenantId },
      select: { homeLocationId: true },
    }),
  ]);

  // Vestiging-badge + filter alleen bij een multi-vestiging-organisatie.
  const multiLocation = locations.length > 1;

  // Standaard gefilterd op de eigen (actieve/thuis)vestiging; `?loc=all` toont
  // alles, `?loc=<id>` een specifieke vestiging. Het filter zit in de query
  // (niet erna), anders kapt `take` de lijst af vóór het filteren.
  const validIds = new Set(locations.map((l) => l.id));
  const selectedLocationId = !multiLocation
    ? null
    : loc === "all"
      ? null
      : loc && validIds.has(loc)
        ? loc
        : await resolveActiveLocationId(member.tenantId, {
            homeLocationId: me?.homeLocationId,
          });

  const MINE_STATUSES: EnrollmentStatus[] = ["ENROLLED", "WAITLISTED"];
  const sessionInclude = {
    groupClass: {
      select: { name: true, description: true, instructorName: true, maxParticipants: true },
    },
    venueLocation: { select: { name: true, timezone: true } },
    // Capaciteit telt alleen actieve statussen (afgemeld/no-show/wachtlijst bezet geen plek).
    _count: {
      select: { enrollments: { where: { status: { in: [...ACTIVE_ENROLLMENT_STATUSES] } } } },
    },
    // Wachtlijst (op volgorde) voor de eigen positie + teller.
    enrollments: {
      where: { status: { in: MINE_STATUSES } },
      orderBy: { enrolledAt: "asc" },
      select: { userId: true, status: true },
    },
  } satisfies Prisma.ClassSessionInclude;

  // Vaste horizon i.p.v. een rij-limiet: met een paar wekelijkse reeksen kapte
  // `take: 40` het rooster al na ±2 weken stil af — een datumgrens is
  // voorspelbaar ("je ziet altijd 3 weken vooruit"). De take blijft als
  // vangnet tegen een extreem vol rooster.
  const horizon = new Date(now.getTime() + ROSTER_HORIZON_DAYS * 24 * 3_600_000);

  const [upcomingRows, mineRows] = await Promise.all([
    prisma.classSession.findMany({
      where: {
        tenantId: member.tenantId,
        // Lopende lessen blijven even zichtbaar (gestart, niet meer boekbaar).
        endsAt: { gte: now },
        startsAt: { lte: horizon },
        ...(selectedLocationId ? { locationId: selectedLocationId } : {}),
      },
      orderBy: { startsAt: "asc" },
      take: 200,
      include: sessionInclude,
    }),
    // "Mijn lessen" blijft bewust ongefilterd: eigen aanmeldingen zie je altijd.
    prisma.classSession.findMany({
      where: {
        tenantId: member.tenantId,
        endsAt: { gte: now },
        enrollments: { some: { userId: member.id, status: { in: MINE_STATUSES } } },
      },
      orderBy: { startsAt: "asc" },
      include: sessionInclude,
    }),
  ]);

  const toCard = (s: (typeof upcomingRows)[number]): SessionCard => {
    const waiting = s.enrollments.filter((e) => e.status === "WAITLISTED");
    const own = s.enrollments.find((e) => e.userId === member.id);
    const max = sessionCapacity(s);
    const count = s._count.enrollments;
    return {
      id: s.id,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      timezone: s.venueLocation.timezone,
      locationId: s.locationId,
      venueName: multiLocation ? s.venueLocation.name : null,
      location: s.location,
      className: s.groupClass.name,
      description: s.groupClass.description,
      instructorName: s.groupClass.instructorName,
      cancelled: s.cancelledAt !== null,
      mine: own ? (own.status === "ENROLLED" ? "enrolled" : "waitlisted") : null,
      waitlistPosition:
        own?.status === "WAITLISTED" ? waiting.findIndex((e) => e.userId === member.id) + 1 : null,
      waitlistCount: waiting.length,
      full: count >= max,
      started: !enrollmentWindowOpen(s, now),
      spotsLeft: Math.max(0, max - count),
      count,
      max,
    };
  };

  const mine = mineRows.map(toCard);
  const upcoming = upcomingRows.map(toCard);
  const message = msg && msg in MESSAGES ? MESSAGES[msg as RoosterMessage] : null;
  const messageTone =
    msg === "closed" || msg === "unchanged" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-green-200 bg-green-50 text-green-900";

  const filterTab = (active: boolean) =>
    active
      ? "shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-xs font-bold text-accent-foreground"
      : "shrink-0 rounded-full border border-border bg-surface-1 px-3.5 py-1.5 text-xs font-medium text-neutral-600 active:bg-surface-2";

  return (
    <Reveal stagger className="flex flex-1 flex-col gap-6 px-5 py-8">
      <RevealItem>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-neutral-500">{t("subtitle")}</p>
      </RevealItem>

      {message ? (
        <RevealItem className="flex flex-col gap-2">
          <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${messageTone}`}>
            {t(message)}
          </p>
          {overlap === "1" ? (
            <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {t("msgOverlap")}
            </p>
          ) : null}
        </RevealItem>
      ) : null}

      {mine.length > 0 ? (
        <RevealItem className="flex flex-col gap-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">{t("myClasses")}</h2>
          <div className="flex flex-col gap-2.5">
            {mine.map((s) => (
              <ClassCard key={`mine-${s.id}`} s={s} />
            ))}
          </div>
        </RevealItem>
      ) : null}

      <RevealItem className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">{t("upcoming")}</h2>

        {multiLocation ? (
          <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
            <Link href="/member/rooster?loc=all" className={filterTab(selectedLocationId === null)}>
              {t("allLocations")}
            </Link>
            {locations.map((l) => (
              <Link key={l.id} href={`/member/rooster?loc=${l.id}`} className={filterTab(selectedLocationId === l.id)}>
                {l.name}
              </Link>
            ))}
          </div>
        ) : null}

        {upcoming.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-7 text-accent" />}
            title={t("emptyTitle")}
            description={t("emptyDesc")}
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {upcoming.map((s) => (
              <ClassCard key={s.id} s={s} />
            ))}
          </div>
        )}
      </RevealItem>
    </Reveal>
  );
}
