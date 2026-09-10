import Link from "next/link";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Permission } from "@/lib/rbac";
import { getLocationScope } from "@/lib/location-access";
import { locationScopeWhere } from "@/lib/location-scope";
import { isFeatureEnabled } from "@/lib/features/service";
import { areClassesEnabled } from "@/lib/classes";
import { QrCode, Users, CalendarClock, AlertTriangle } from "@/components/ui/icons";

type Action = {
  href: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
};

/**
 * Vloer-acties: wat een medewerker met een telefoon in de zaal nodig heeft,
 * zónder eerst door een menu te moeten. Alleen op mobiel (`lg:hidden`) — op een
 * desktop staat de volledige navigatie al in beeld.
 *
 * Alles wijst naar bestaande routes en is gefilterd op de effectieve permissies
 * én de feature-flags, dus er verschijnt nooit een knop die op een 403 of een
 * uitgeschakelde module uitkomt.
 */
export async function FloorActions({
  tenantId,
  userId,
  role,
  permissions,
}: {
  tenantId: string;
  userId: string;
  role: Role;
  permissions: Set<Permission>;
}) {
  const has = (p: Permission) => permissions.has(p);
  const canScan =
    has("machines:qr-export") || has("maintenance:manage") || has("defects:manage");

  const [classesOn, defectsOn] = await Promise.all([
    has("schedule:manage") ? areClassesEnabled(tenantId) : Promise.resolve(false),
    has("defects:manage") ? isFeatureEnabled(tenantId, "defects") : Promise.resolve(false),
  ]);

  // Aanwezigheid afvinken hoort bij één concrete les: de sessie die nu bezig is
  // of vandaag als eerste volgt, binnen de vestigingen waar deze medewerker bij
  // mag (fail-closed, net als elders). Zonder les linken we naar het rooster.
  let attendanceHref = "/owner/rooster";
  let attendanceHint: string | undefined;
  if (classesOn) {
    const scope = await getLocationScope({ id: userId, role, tenantId });
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const session = await prisma.classSession.findFirst({
      where: {
        ...locationScopeWhere(tenantId, scope),
        cancelledAt: null,
        endsAt: { gte: now },
        startsAt: { lte: endOfDay },
      },
      orderBy: { startsAt: "asc" },
      // `classId`, niet `id`: /owner/rooster/[id] is de **lestype**-pagina (met
      // daarop de sessies + het aanwezigheidspaneel). Een sessie-id geeft daar 404.
      select: { classId: true, groupClass: { select: { name: true } } },
    });
    if (session) {
      attendanceHref = `/owner/rooster/${session.classId}`;
      attendanceHint = session.groupClass.name;
    }
  }

  const actions: Action[] = [
    ...(canScan
      ? [
          {
            href: "/owner/scan",
            label: "Scannen",
            hint: "Apparaat-QR",
            icon: <QrCode className="size-5" />,
          },
        ]
      : []),
    ...(classesOn
      ? [
          {
            href: attendanceHref,
            label: "Aanwezigheid",
            hint: attendanceHint ?? "Lessen",
            icon: <CalendarClock className="size-5" />,
          },
        ]
      : []),
    ...(has("members:view")
      ? [
          {
            href: "/owner/members",
            label: "Lid zoeken",
            hint: "Ledenlijst",
            icon: <Users className="size-5" />,
          },
        ]
      : []),
    ...(defectsOn
      ? [
          {
            href: "/owner/defects",
            label: "Defecten",
            hint: "Meldingen",
            icon: <AlertTriangle className="size-5" />,
          },
        ]
      : []),
  ];

  if (actions.length === 0) return null;

  return (
    <section className="lg:hidden">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Snel op de vloer
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((a) => (
          <Link
            key={a.href + a.label}
            href={a.href}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface-1 p-3 shadow-sm transition-colors active:bg-accent-soft"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              {a.icon}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-neutral-900">
                {a.label}
              </span>
              {a.hint ? (
                <span className="block truncate text-xs text-neutral-500">{a.hint}</span>
              ) : null}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
