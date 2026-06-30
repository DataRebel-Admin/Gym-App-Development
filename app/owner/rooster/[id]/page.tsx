import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { requireOwner } from "@/lib/owner";
import { formatSessionStart, formatTimeRange } from "@/lib/datetime";
import { AddSessionForm } from "../class-forms";
import { deleteClass, deleteSession } from "../actions";

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
  const owner = await requireOwner();

  const groupClass = await prisma.groupClass.findFirst({
    where: { id, tenantId: owner.tenantId },
    include: {
      sessions: {
        orderBy: { startsAt: "asc" },
        include: { _count: { select: { enrollments: true } } },
      },
    },
  });
  if (!groupClass) notFound();

  return (
    <div className="flex flex-col gap-8 px-6 py-8">
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
        <AddSessionForm classId={groupClass.id} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">
          Sessies ({groupClass.sessions.length})
        </h2>
        {groupClass.sessions.length === 0 ? (
          <p className="text-sm text-neutral-500">Nog geen sessies ingepland.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {groupClass.sessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 text-sm"
              >
                <span>
                  <span className="font-medium text-neutral-900">
                    {formatSessionStart(s.startsAt)}
                  </span>{" "}
                  <span className="text-neutral-500">
                    ({formatTimeRange(s.startsAt, s.endsAt)})
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
              </li>
            ))}
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
