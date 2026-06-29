import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { formatSessionStart, formatTimeRange } from "@/lib/datetime";
import { NewClassForm } from "./class-forms";

export default async function RoosterPage() {
  const owner = await requireOwner();

  const [classes, upcoming] = await Promise.all([
    prisma.groupClass.findMany({
      where: { tenantId: owner.tenantId },
      orderBy: { name: "asc" },
      include: { _count: { select: { sessions: true } } },
    }),
    prisma.classSession.findMany({
      where: { tenantId: owner.tenantId, startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 25,
      include: {
        groupClass: { select: { name: true, maxParticipants: true } },
        _count: { select: { enrollments: true } },
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Rooster
        </h1>
        <p className="text-sm text-neutral-500">Beheer groepslessen en sessies.</p>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Nieuwe les</h2>
        <NewClassForm />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">
          Groepslessen ({classes.length})
        </h2>
        {classes.length === 0 ? (
          <p className="text-sm text-neutral-500">Nog geen lessen.</p>
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
                    {c._count.sessions} sessies · max {c.maxParticipants}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">
          Komende sessies
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-neutral-500">Nog niets ingepland.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 text-sm"
              >
                <span>
                  <span className="font-medium text-neutral-900">
                    {s.groupClass.name}
                  </span>{" "}
                  <span className="text-neutral-500">
                    — {formatSessionStart(s.startsAt)}{" "}
                    ({formatTimeRange(s.startsAt, s.endsAt)})
                  </span>
                </span>
                <span className="text-neutral-500">
                  {s._count.enrollments}/{s.groupClass.maxParticipants}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
