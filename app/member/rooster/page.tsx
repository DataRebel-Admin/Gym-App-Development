import { requireMember } from "@/lib/member";
import { prisma } from "@/lib/db";
import { formatSessionStart, formatTimeRange } from "@/lib/datetime";
import { enroll, unenroll } from "./actions";

export const metadata = { title: "Rooster" };

export default async function MemberRoosterPage() {
  const member = await requireMember();

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

  const mine = sessions.filter((s) => s.enrollments.length > 0);

  return (
    <div className="flex flex-1 flex-col gap-6 px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Rooster
      </h1>

      {mine.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">Mijn lessen</h2>
          <ul className="flex flex-col gap-2">
            {mine.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-accent bg-accent/5 px-4 py-3 text-sm"
              >
                <span>
                  <span className="font-medium text-neutral-900">
                    {s.groupClass.name}
                  </span>
                  <span className="block text-neutral-500">
                    {formatSessionStart(s.startsAt)} ·{" "}
                    {formatTimeRange(s.startsAt, s.endsAt)}
                  </span>
                </span>
                <form action={unenroll}>
                  <input type="hidden" name="sessionId" value={s.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                  >
                    Afmelden
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">Komende lessen</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Er staan nog geen lessen gepland.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => {
              const enrolled = s.enrollments.length > 0;
              const full = s._count.enrollments >= s.groupClass.maxParticipants;
              const spotsLeft = s.groupClass.maxParticipants - s._count.enrollments;
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 text-sm"
                >
                  <span>
                    <span className="font-medium text-neutral-900">
                      {s.groupClass.name}
                    </span>
                    <span className="block text-neutral-500">
                      {formatSessionStart(s.startsAt)} ·{" "}
                      {formatTimeRange(s.startsAt, s.endsAt)}
                      {s.location ? ` · ${s.location}` : ""}
                    </span>
                    <span className="block text-xs text-neutral-400">
                      {enrolled
                        ? "je bent aangemeld"
                        : full
                          ? "vol"
                          : `${spotsLeft} plek${spotsLeft === 1 ? "" : "ken"} vrij`}
                    </span>
                  </span>

                  {enrolled ? (
                    <form action={unenroll}>
                      <input type="hidden" name="sessionId" value={s.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                      >
                        Afmelden
                      </button>
                    </form>
                  ) : full ? (
                    <span className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-400">
                      Vol
                    </span>
                  ) : (
                    <form action={enroll}>
                      <input type="hidden" name="sessionId" value={s.id} />
                      <button
                        type="submit"
                        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90"
                      >
                        Aanmelden
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
