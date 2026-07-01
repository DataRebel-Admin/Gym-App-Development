import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { requireMember } from "@/lib/member";
import { areClassesEnabled } from "@/lib/classes";
import { prisma } from "@/lib/db";
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
        {s.location ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4 text-accent" />
            {s.location}
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

export default async function MemberRoosterPage() {
  const member = await requireMember();
  if (!(await areClassesEnabled(member.tenantId))) notFound();
  const t = await getTranslations("member.rooster");

  const sessions = await prisma.classSession.findMany({
    where: { tenantId: member.tenantId, startsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    take: 40,
    include: {
      groupClass: { select: { name: true, instructorName: true, maxParticipants: true } },
      _count: { select: { enrollments: true } },
      enrollments: { where: { userId: member.id }, select: { id: true } },
    },
  });

  const cards: SessionCard[] = sessions.map((s) => ({
    id: s.id,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
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
        {cards.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-7 text-accent" />}
            title={t("emptyTitle")}
            description={t("emptyDesc")}
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {cards.map((s) => (
              <ClassCard key={s.id} s={s} />
            ))}
          </div>
        )}
      </RevealItem>
    </Reveal>
  );
}
