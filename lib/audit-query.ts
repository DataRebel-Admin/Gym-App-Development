import "server-only";
import type { Prisma, AuditLog, AuditStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AuditRowData } from "@/components/audit/types";

/** Zet Prisma-rijen om naar de client-veilige vorm voor de tijdlijn. */
export function serializeAuditRows(
  logs: AuditLog[],
  tenantName?: Map<string, string>
): AuditRowData[] {
  return logs.map((l) => ({
    id: l.id,
    createdAt: l.createdAt.toISOString(),
    action: l.action,
    category: l.category,
    status: l.status,
    actorEmail: l.actorEmail,
    actorRole: l.actorRole,
    tenantId: l.tenantId,
    tenantName: l.tenantId ? (tenantName?.get(l.tenantId) ?? null) : null,
    targetType: l.targetType,
    targetId: l.targetId,
    oldValue: l.oldValue,
    newValue: l.newValue,
    ipAddress: l.ipAddress,
    userAgent: l.userAgent,
    metadata: l.metadata,
  }));
}

export type AuditFilters = {
  search?: string; // vrije tekst: action / actorEmail / targetId
  actorEmail?: string;
  category?: string;
  action?: string;
  targetType?: string;
  status?: AuditStatus;
  dateFrom?: Date;
  dateTo?: Date;
};

export type AuditQueryParams = {
  /** Wanneer gezet → hard gescoped op deze tenant (Tenant Admin). */
  tenantId?: string;
  /** Superadmin: filter optioneel op één tenant; leeg = alle tenants. */
  filters?: AuditFilters;
  page?: number;
  pageSize?: number;
  sort?: "asc" | "desc";
};

export const DEFAULT_PAGE_SIZE = 50;

/** Bouwt de Prisma-where uit scoping + filters (gedeeld door pagina én export). */
export function buildAuditWhere(
  tenantId: string | undefined,
  filters: AuditFilters = {}
): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (tenantId) where.tenantId = tenantId;

  if (filters.category) where.category = filters.category;
  if (filters.action) where.action = filters.action;
  if (filters.targetType) where.targetType = filters.targetType;
  if (filters.status) where.status = filters.status;
  if (filters.actorEmail) where.actorEmail = filters.actorEmail;

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    };
  }

  const q = filters.search?.trim();
  if (q) {
    where.OR = [
      { action: { contains: q, mode: "insensitive" } },
      { actorEmail: { contains: q, mode: "insensitive" } },
      { targetId: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}

export type AuditQueryResult = {
  rows: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** Gepagineerde, gefilterde auditlog-query. Tenant-scoping wordt afgedwongen
 *  door de caller (owner geeft altijd een tenantId mee). */
export async function queryAuditLogs(
  params: AuditQueryParams
): Promise<AuditQueryResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const where = buildAuditWhere(params.tenantId, params.filters);

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: params.sort ?? "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Alle regels voor export (zonder paginering, met cap). */
export function queryAuditLogsForExport(
  tenantId: string | undefined,
  filters: AuditFilters,
  cap = 10000
): Promise<AuditLog[]> {
  return prisma.auditLog.findMany({
    where: buildAuditWhere(tenantId, filters),
    orderBy: { createdAt: "desc" },
    take: cap,
  });
}

/** Recente activiteit voor de dashboard-widget. */
export function getRecentActivity(
  tenantId: string,
  limit = 6
): Promise<AuditLog[]> {
  return prisma.auditLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

type RawParams = Record<string, string | undefined>;

/** Vertaalt URL-searchParams naar filters + paginering (gedeeld pagina/export). */
export function parseAuditSearchParams(sp: RawParams): {
  filters: AuditFilters;
  tenantParam?: string;
  page: number;
} {
  const filters: AuditFilters = {};
  if (sp.search) filters.search = sp.search;
  if (sp.category) filters.category = sp.category;
  if (sp.action) filters.action = sp.action;
  if (sp.actor) filters.actorEmail = sp.actor;
  if (sp.status === "SUCCESS" || sp.status === "FAILED") filters.status = sp.status;
  if (sp.from) {
    const d = new Date(sp.from);
    if (!Number.isNaN(d.getTime())) filters.dateFrom = d;
  }
  if (sp.to) {
    const d = new Date(sp.to);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999); // hele einddag meenemen
      filters.dateTo = d;
    }
  }
  return {
    filters,
    tenantParam: sp.tenant || undefined,
    page: Math.max(1, Number(sp.page ?? "1") || 1),
  };
}

/** Distinct actor-e-mails binnen de scope, voor de gebruiker-filter. */
export async function getAuditActors(
  tenantId: string | undefined
): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    where: tenantId ? { tenantId } : {},
    distinct: ["actorEmail"],
    select: { actorEmail: true },
    orderBy: { actorEmail: "asc" },
    take: 200,
  });
  return rows.map((r) => r.actorEmail).filter((e): e is string => Boolean(e));
}
