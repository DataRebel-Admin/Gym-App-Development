import Link from "next/link";
import { prisma } from "@/lib/db";
import type { Permission } from "@/lib/rbac";
import { listCoachMembers } from "@/lib/coach-assignments";
import { Card } from "@/components/ui/card";

const TIME_FMT = new Intl.DateTimeFormat("nl-NL", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function StatCard({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const body = (
    <Card className="flex flex-col gap-1 p-5">
      <span className="text-3xl font-bold tracking-tight text-neutral-900">{value}</span>
      <span className="text-sm text-neutral-500">{label}</span>
    </Card>
  );
  return href ? (
    <Link href={href} className="transition-transform hover:-translate-y-0.5">
      {body}
    </Link>
  ) : (
    body
  );
}

/**
 * Rol-bewust dashboard voor de Sportschoolmedewerker: alleen relevante, op de
 * effectieve permissies afgestemde informatie. Geen audit/financiële data.
 */
export async function StaffDashboard({
  tenantId,
  coachId,
  permissions,
  name,
}: {
  tenantId: string;
  coachId: string;
  permissions: Set<Permission>;
  name?: string | null;
}) {
  const today = startOfToday();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const canSchemas = permissions.has("schemas:manage");
  const canSchedule = permissions.has("schedule:manage");
  const canMeasure = permissions.has("measurements:manage");

  const canMembers = permissions.has("members:view");

  const [activeToday, openRequests, newMeasurements, upcoming, myMembers] = await Promise.all([
    prisma.workoutSession.count({ where: { tenantId, startedAt: { gte: today } } }),
    canSchemas
      ? prisma.schemaRequest.count({ where: { tenantId, status: "NEW" } })
      : Promise.resolve(0),
    canMeasure
      ? prisma.measurement.count({ where: { tenantId, measuredAt: { gte: weekAgo } } })
      : Promise.resolve(0),
    canSchedule
      ? prisma.classSession.findMany({
          where: { tenantId, startsAt: { gte: now } },
          orderBy: { startsAt: "asc" },
          take: 5,
          select: {
            id: true,
            startsAt: true,
            location: true,
            groupClass: { select: { name: true, instructorName: true } },
          },
        })
      : Promise.resolve([]),
    canMembers ? listCoachMembers(tenantId, coachId, 6) : Promise.resolve([]),
  ]);

  const firstName = name?.split(" ")[0];

  const quickActions: { label: string; href: string }[] = [];
  if (canSchemas) quickActions.push({ label: "Schema maken", href: "/owner/schemas" });
  if (permissions.has("members:view")) quickActions.push({ label: "Leden bekijken", href: "/owner/members" });
  if (canSchedule) quickActions.push({ label: "Rooster beheren", href: "/owner/rooster" });
  if (permissions.has("exercises:manage")) quickActions.push({ label: "Eigen oefeningen", href: "/owner/exercises" });

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <section className="panel-sheen relative overflow-hidden rounded-3xl border border-border bg-surface-1/80 p-7 shadow-lg backdrop-blur-xl">
        <div aria-hidden className="bg-aura pointer-events-none absolute inset-0" />
        <div className="relative">
          <p className="text-sm font-medium text-accent">
            {now.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-neutral-900">
            Welkom terug{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {activeToday > 0
              ? `${activeToday} ${activeToday === 1 ? "lid heeft" : "leden hebben"} vandaag al getraind.`
              : "Nog geen trainingen vandaag — tijd om je leden te activeren."}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Leden actief vandaag" value={activeToday} />
        {canMembers ? (
          <StatCard label="Mijn leden" value={myMembers.length} href="/owner/members?mine=1" />
        ) : null}
        {canSchemas ? (
          <StatCard label="Openstaande schema-aanvragen" value={openRequests} href="/owner/requests" />
        ) : null}
        {canMeasure ? (
          <StatCard label="Nieuwe metingen (7 dagen)" value={newMeasurements} />
        ) : null}
      </div>

      {canMembers && myMembers.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">Mijn leden</h2>
            <Link href="/owner/members?mine=1" className="text-xs text-accent hover:underline">
              Alles bekijken →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {myMembers.map((m) => (
              <Link key={m.memberId} href={`/owner/members/${m.memberId}`}>
                <Card className="flex items-center gap-3 p-3 transition-colors hover:bg-neutral-50">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                    {(m.name ?? m.email).charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-neutral-900">
                      {m.name ?? m.email}
                    </span>
                    <span className="block truncate text-xs text-neutral-500">{m.email}</span>
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {canSchedule ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-neutral-900">Aankomende lessen</h2>
          {upcoming.length === 0 ? (
            <Card className="p-6 text-center text-sm text-neutral-500">
              Geen geplande lessen.{" "}
              <Link href="/owner/rooster" className="text-accent hover:underline">
                Naar het rooster →
              </Link>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {upcoming.map((c) => (
                <Card key={c.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-900">{c.groupClass.name}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {TIME_FMT.format(c.startsAt)}
                      {c.location ? ` · ${c.location}` : ""}
                      {c.groupClass.instructorName ? ` · ${c.groupClass.instructorName}` : ""}
                    </p>
                  </div>
                  <Link href="/owner/rooster" className="shrink-0 text-xs text-accent hover:underline">
                    Beheren →
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {quickActions.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-neutral-900">Snelle acties</h2>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="rounded-xl border border-border bg-surface-1 px-4 py-2 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-50"
              >
                {a.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
