import "server-only";
import type { Role, TenantStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serializeAuditRows } from "@/lib/audit-query";
import type { AuditRowData } from "@/components/audit/types";

const DAY = 86_400_000;

/** ±% t.o.v. de vorige periode. prev 0 → +100% als er nu iets is, anders 0. */
function delta(cur: number, prev: number): number {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

export type TenantHealthRow = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  accentColor: string | null;
  members: number;
  team: number; // admins + medewerkers
  admins: number;
  sessions7: number;
  lastActivity: string | null; // ISO
  createdAt: string; // ISO
  flags: TenantFlag[];
  attention: number; // sorteergewicht (hoger = urgenter)
};

export type TenantFlag = "inactive" | "no_admin" | "empty" | "stale";

export type AttentionItem = {
  key: string;
  tone: "danger" | "warning" | "accent";
  icon: string;
  title: string;
  count: number;
  detail: string;
  href: string;
};

export type AdminDashboardData = {
  kpis: {
    tenantsActive: number;
    tenantsTotal: number;
    newTenants30: number;
    newTenantsTrend: number;
    members: number;
    newMembers30: number;
    newMembersTrend: number;
    sessions7: number;
    sessionsTrend: number;
    admins: number;
    staff: number;
    superadmins: number;
  };
  attention: AttentionItem[];
  tenants: TenantHealthRow[];
  weeklySessions: { label: string; count: number }[];
  recentAudit: AuditRowData[];
  generatedAt: string;
};

/**
 * Aggregeert alles voor het superadmin-cockpit in één ronde parallelle queries:
 * platform-KPI's (met trend t.o.v. vorige periode), actiegerichte
 * aandachtssignalen, per-tenant gezondheid en de wekelijkse trainingstrend.
 * Platformbreed → bewust de base `prisma` (geen tenant-scope).
 */
export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const now = Date.now();
  const d7 = new Date(now - 7 * DAY);
  const d14 = new Date(now - 14 * DAY);
  const d30 = new Date(now - 30 * DAY);
  const d60 = new Date(now - 60 * DAY);
  const nowDate = new Date(now);

  // 8 wekelijkse buckets (chronologisch straks omgekeerd).
  const weekRanges = Array.from({ length: 8 }, (_, i) => ({
    from: new Date(now - (i + 1) * 7 * DAY),
    to: new Date(now - i * 7 * DAY),
  }));

  const [
    tenants,
    globalRoleCounts,
    newMembers30,
    newMembersPrev30,
    newTenants30,
    newTenantsPrev30,
    sessions7,
    sessionsPrev7,
    sessionsByTenant7,
    lastActivityByTenant,
    membersByTenant,
    teamByTenant,
    adminsByTenant,
    failed7,
    expiredInvites,
    deletionRequests,
    inactiveTenants,
    recentAuditRows,
  ] = await Promise.all([
    prisma.tenant.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        accentColor: true,
        createdAt: true,
      },
    }),
    prisma.user.groupBy({ by: ["role"], _count: true }),
    prisma.user.count({
      where: { role: "TENANT_MEMBER", createdAt: { gte: d30 } },
    }),
    prisma.user.count({
      where: { role: "TENANT_MEMBER", createdAt: { gte: d60, lt: d30 } },
    }),
    prisma.tenant.count({ where: { deletedAt: null, createdAt: { gte: d30 } } }),
    prisma.tenant.count({
      where: { deletedAt: null, createdAt: { gte: d60, lt: d30 } },
    }),
    prisma.workoutSession.count({ where: { startedAt: { gte: d7 } } }),
    prisma.workoutSession.count({ where: { startedAt: { gte: d14, lt: d7 } } }),
    prisma.workoutSession.groupBy({
      by: ["tenantId"],
      where: { startedAt: { gte: d7 } },
      _count: true,
    }),
    prisma.workoutSession.groupBy({
      by: ["tenantId"],
      _max: { startedAt: true },
    }),
    prisma.user.groupBy({
      by: ["tenantId"],
      where: { role: "TENANT_MEMBER", archivedAt: null },
      _count: true,
    }),
    prisma.user.groupBy({
      by: ["tenantId"],
      where: {
        role: { in: ["TENANT_ADMIN", "TENANT_STAFF"] },
        archivedAt: null,
      },
      _count: true,
    }),
    prisma.user.groupBy({
      by: ["tenantId"],
      where: { role: "TENANT_ADMIN", active: true, archivedAt: null },
      _count: true,
    }),
    prisma.auditLog.count({ where: { status: "FAILED", createdAt: { gte: d7 } } }),
    prisma.invitation.count({
      where: { acceptedAt: null, expiresAt: { lt: nowDate } },
    }),
    prisma.user.count({ where: { deletionRequestedAt: { not: null } } }),
    prisma.tenant.count({ where: { deletedAt: null, status: "INACTIVE" } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const weeklyCounts = await Promise.all(
    weekRanges.map((r) =>
      prisma.workoutSession.count({
        where: { startedAt: { gte: r.from, lt: r.to } },
      })
    )
  );

  const roleCount = (r: Role) =>
    globalRoleCounts.find((g) => g.role === r)?._count ?? 0;

  // Per-tenant lookups.
  const membersMap = new Map<string, number>();
  for (const g of membersByTenant)
    if (g.tenantId) membersMap.set(g.tenantId, g._count);
  const teamMap = new Map<string, number>();
  for (const g of teamByTenant) if (g.tenantId) teamMap.set(g.tenantId, g._count);
  const adminsMap = new Map<string, number>();
  for (const g of adminsByTenant)
    if (g.tenantId) adminsMap.set(g.tenantId, g._count);
  const sessions7Map = new Map<string, number>();
  for (const g of sessionsByTenant7)
    if (g.tenantId) sessions7Map.set(g.tenantId, g._count);
  const lastActivityMap = new Map<string, Date | null>();
  for (const g of lastActivityByTenant)
    if (g.tenantId) lastActivityMap.set(g.tenantId, g._max.startedAt ?? null);

  const tenantRows: TenantHealthRow[] = tenants.map((t) => {
    const members = membersMap.get(t.id) ?? 0;
    const team = teamMap.get(t.id) ?? 0;
    const admins = adminsMap.get(t.id) ?? 0;
    const last = lastActivityMap.get(t.id) ?? null;
    const flags: TenantFlag[] = [];
    if (t.status !== "ACTIVE") flags.push("inactive");
    if (t.status === "ACTIVE" && admins === 0) flags.push("no_admin");
    if (members === 0) flags.push("empty");
    if (
      t.status === "ACTIVE" &&
      members > 0 &&
      (last == null || last < d30)
    )
      flags.push("stale");

    const attention =
      (flags.includes("inactive") ? 40 : 0) +
      (flags.includes("no_admin") ? 30 : 0) +
      (flags.includes("stale") ? 15 : 0) +
      (flags.includes("empty") ? 10 : 0);

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      accentColor: t.accentColor,
      members,
      team,
      admins,
      sessions7: sessions7Map.get(t.id) ?? 0,
      lastActivity: last ? last.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
      flags,
      attention,
    };
  });

  tenantRows.sort(
    (a, b) => b.attention - a.attention || b.members - a.members
  );

  // Afgeleide aandachtstellers uit de tenant-rijen.
  const noAdminCount = tenantRows.filter((t) =>
    t.flags.includes("no_admin")
  ).length;
  const staleCount = tenantRows.filter((t) => t.flags.includes("stale")).length;
  const emptyCount = tenantRows.filter((t) => t.flags.includes("empty")).length;

  const attention: AttentionItem[] = [];
  if (inactiveTenants > 0)
    attention.push({
      key: "inactive",
      tone: "danger",
      icon: "⏸️",
      title: "Inactieve tenants",
      count: inactiveTenants,
      detail: "Sportscholen die op non-actief staan.",
      href: "/admin/tenants",
    });
  if (noAdminCount > 0)
    attention.push({
      key: "no_admin",
      tone: "danger",
      icon: "🔑",
      title: "Tenants zonder beheerder",
      count: noAdminCount,
      detail: "Geen actieve tenant-admin — niemand kan de gym beheren.",
      href: "/admin/tenants",
    });
  if (failed7 > 0)
    attention.push({
      key: "failed",
      tone: "warning",
      icon: "🚨",
      title: "Mislukte gebeurtenissen (7d)",
      count: failed7,
      detail: "Mislukte logins of acties in de audit-log.",
      href: "/admin/audit?status=FAILED",
    });
  if (staleCount > 0)
    attention.push({
      key: "stale",
      tone: "warning",
      icon: "💤",
      title: "Stille tenants",
      count: staleCount,
      detail: "Leden, maar geen training in de laatste 30 dagen.",
      href: "/admin/tenants",
    });
  if (expiredInvites > 0)
    attention.push({
      key: "invites",
      tone: "accent",
      icon: "✉️",
      title: "Verlopen uitnodigingen",
      count: expiredInvites,
      detail: "Openstaande uitnodigingen die zijn verlopen.",
      href: "/admin/users",
    });
  if (deletionRequests > 0)
    attention.push({
      key: "deletion",
      tone: "warning",
      icon: "🗑️",
      title: "Verwijderverzoeken",
      count: deletionRequests,
      detail: "Accounts die om verwijdering hebben gevraagd.",
      href: "/admin/users",
    });
  if (emptyCount > 0)
    attention.push({
      key: "empty",
      tone: "accent",
      icon: "🌱",
      title: "Lege tenants",
      count: emptyCount,
      detail: "Aangemaakt maar nog zonder leden — onboarding nodig.",
      href: "/admin/tenants",
    });

  const tenantNameMap = new Map(tenants.map((t) => [t.id, t.name]));
  const recentAudit = serializeAuditRows(recentAuditRows, tenantNameMap);

  const weeklySessions = weekRanges
    .map((r, i) => ({
      label: r.from.toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "short",
      }),
      count: weeklyCounts[i] ?? 0,
    }))
    .reverse();

  const tenantsActive = tenantRows.filter((t) => t.status === "ACTIVE").length;

  return {
    kpis: {
      tenantsActive,
      tenantsTotal: tenantRows.length,
      newTenants30,
      newTenantsTrend: delta(newTenants30, newTenantsPrev30),
      members: roleCount("TENANT_MEMBER"),
      newMembers30,
      newMembersTrend: delta(newMembers30, newMembersPrev30),
      sessions7,
      sessionsTrend: delta(sessions7, sessionsPrev7),
      admins: roleCount("TENANT_ADMIN"),
      staff: roleCount("TENANT_STAFF"),
      superadmins: roleCount("SUPERADMIN"),
    },
    attention,
    tenants: tenantRows,
    weeklySessions,
    recentAudit,
    generatedAt: new Date(now).toISOString(),
  };
}
