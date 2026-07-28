import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { requireMember } from "@/lib/member";
import { areClassesEnabled } from "@/lib/classes";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ACTIVE_ENROLLMENT_STATUSES } from "@/lib/class-attendance";
import { getTenantLocations } from "@/lib/locations";
import { resolveActiveLocationId } from "@/lib/location-resolve";
import { formatSessionStart, formatTimeRange } from "@/lib/datetime";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarDays, Clock, MapPin, Users, Check } from "@/components/ui/icons";
import { enroll, unenroll } from "./actions";

export async function generateMetadata() {
  const t = await getTranslations("member.rooster");
  return { title: t("metaTitle") };
}

type SessionCard = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  locationId: string;
  /** Vestiging-naam (alleen gezet bij een multi-vestiging-organisatie). */
  venueName: string | null;
  location: string | null;
  className: string;
  instructorName: string | null;
  enrolled: boolean;
  full: boolean;
  spotsLeft: number;
  count: number;
  max: number;
};

function ClassCard({ s }: { s: SessionCard }) {
  const t = useTranslations("member.rooster");
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        s.enrolled ? "border-accent ring-1 ring-accent/20 bg-accent-soft" : "border-border bg-surface-1"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-neutral-900">
            {s.className}
          </p>
          {s.instructorName ? (
            <p className="text-xs text-neutral-500">{t("withInstructor", { name: s.instructorName })}</p>
          ) : null}
        </div>
        {s.enrolled ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-foreground">
            <Check className="size-3" /> {t("enrolled")}
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

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-neutral-600">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-4 text-accent" />
          <span className="capitalize">{formatSessionStart(s.startsAt)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-4 text-accent" />
          {formatTimeRange(s.startsAt, s.endsAt)}
        </span>
        {s.venueName || s.location ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4 text-accent" />
            {[s.venueName, s.location].filter(Boolean).join(" · ")}
          </span>
        ) : null}
      </div>

      <div className="mt-3.5">
        {s.enrolled ? (
          <form action={unenroll}>
            <input type="hidden" name="sessionId" value={s.id} />
            <button
              type="submit"
              className="w-full rounded-xl border border-border bg-surface-1 px-4 py-2.5 text-sm font-semibold text-neutral-700 active:bg-surface-2"
            >
              {t("unenroll")}
            </button>
          </form>
        ) : s.full ? (
          <button
            type="button"
            disabled
            className="w-full rounded-xl bg-surface-2 px-4 py-2.5 text-sm font-semibold text-neutral-400"
          >
            {t("fullyBooked")}
          </button>
        ) : (
          <form action={enroll}>
            <input type="hidden" name="sessionId" value={s.id} />
            <button
              type="submit"
              className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground active:opacity-90"
            >
              {t("enroll")}
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
  searchParams: Promise<{ loc?: string }>;
}) {
  const member = await requireMember();
  if (!(await areClassesEnabled(member.tenantId))) notFound();
  const t = await getTranslations("member.rooster");
  const { loc } = await searchParams;

  const [sessions, locations, me] = await Promise.all([
    prisma.classSession.findMany({
      where: { tenantId: member.tenantId, startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 40,
      include: {
        groupClass: { select: { name: true, instructorName: true, maxParticipants: true } },
        venueLocation: { select: { name: true } },
        // Capaciteit telt alleen actieve statussen (afgemeld/no-show bezet geen plek).
        _count: {
          select: { enrollments: { where: { status: { in: [...ACTIVE_ENROLLMENT_STATUSES] } } } },
        },
        enrollments: { where: { userId: member.id, status: "ENROLLED" }, select: { id: true } },
      },
    }),
    getTenantLocations(member.tenantId),
    prisma.user.findFirst({
      where: { id: member.id, tenantId: member.tenantId },
      select: { homeLocationId: true },
    }),
  ]);

  // Vestiging-badge + filter alleen bij een multi-vestiging-organisatie.
  const multiLocation = locations.length > 1;

  // Standaard gefilterd op de eigen (actieve/thuis)vestiging; `?loc=all` toont
  // alles, `?loc=<id>` een specifieke vestiging. "Mijn lessen" blijft bewust
  // ongefilterd — eigen aanmeldingen zie je altijd, waar ze ook zijn.
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

  const cards: SessionCard[] = sessions.map((s) => ({
    id: s.id,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    locationId: s.locationId,
    venueName: multiLocation ? s.venueLocation.name : null,
    location: s.location,
    className: s.groupClass.name,
    instructorName: s.groupClass.instructorName,
    enrolled: s.enrollments.length > 0,
    full: s._count.enrollments >= s.groupClass.maxParticipants,
    spotsLeft: s.groupClass.maxParticipants - s._count.enrollments,
    count: s._count.enrollments,
    max: s.groupClass.maxParticipants,
  }));
  const mine = cards.filter((s) => s.enrolled);
  const upcoming = selectedLocationId
    ? cards.filter((s) => s.locationId === selectedLocationId)
    : cards;

  const filterTab = (active: boolean) =>
    active
      ? "shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-xs font-bold text-accent-foreground"
      : "shrink-0 rounded-full border border-border bg-surface-1 px-3.5 py-1.5 text-xs font-medium text-neutral-600 active:bg-surface-2";

  return (
    <Reveal stagger className="flex flex-1 flex-col gap-6 px-5 py-8">
      <RevealItem>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">{t("subtitle")}</p>
      </RevealItem>

      {mine.length > 0 ? (
        <RevealItem className="flex flex-col gap-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            {t("myClasses")}
          </h2>
          <div className="flex flex-col gap-2.5">
            {mine.map((s) => (
              <ClassCard key={`mine-${s.id}`} s={s} />
            ))}
          </div>
        </RevealItem>
      ) : null}

      <RevealItem className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          {t("upcoming")}
        </h2>

        {multiLocation ? (
          <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
            <Link href="/member/rooster?loc=all" className={filterTab(selectedLocationId === null)}>
              {t("allLocations")}
            </Link>
            {locations.map((l) => (
              <Link
                key={l.id}
                href={`/member/rooster?loc=${l.id}`}
                className={filterTab(selectedLocationId === l.id)}
              >
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
