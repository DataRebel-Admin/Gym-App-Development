import "server-only";
import type {
  Prisma,
  AppReport,
  ReportType,
  ReportStatus,
  ReportSeverity,
} from "@prisma/client";
import { prisma } from "@/lib/db";

// Querylaag voor de app-meldingen-inbox (/admin/meldingen). Spiegel van
// lib/audit-query.ts. AppReport heeft bewust géén FK's, dus weergavenamen
// (tenant, melder) worden per pagina batch-gefetcht op de id-sets.

/** Herkomst van een melding: lid (sporter) of sportschool-zijde (staff/admin). */
export type ReportOrigin = "lid" | "sportschool";

const GYM_ROLES = ["TENANT_ADMIN", "TENANT_STAFF", "SUPERADMIN"];

export function reportOrigin(reporterRole: string | null): ReportOrigin {
  return reporterRole && GYM_ROLES.includes(reporterRole) ? "sportschool" : "lid";
}

export type ReportFilters = {
  search?: string; // vrije tekst: titel / omschrijving / route / id
  origin?: ReportOrigin;
  type?: ReportType;
  status?: ReportStatus;
  severity?: ReportSeverity;
  platform?: string;
  appVersion?: string;
  tenantId?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

export const DEFAULT_PAGE_SIZE = 50;

const TYPE_VALUES = ["BUG", "FEEDBACK", "QUESTION"] as const;
const STATUS_VALUES = [
  "NEW",
  "TRIAGED",
  "IN_PROGRESS",
  "RESOLVED",
  "WONTFIX",
  "DUPLICATE",
] as const;
const SEVERITY_VALUES = ["LOW", "NORMAL", "HIGH", "BLOCKER"] as const;

/** Client-veilige rij (datums als ISO-strings, namen gedenormaliseerd). */
export type ReportRowData = {
  id: string;
  ref: string;
  type: ReportType;
  status: ReportStatus;
  severity: ReportSeverity;
  origin: ReportOrigin;
  reporterRole: string | null;
  reporterName: string | null; // null = anoniem of verwijderd account
  reporterEmail: string | null;
  contactAllowed: boolean;
  tenantId: string | null;
  tenantName: string | null;
  title: string;
  description: string;
  hasScreenshot: boolean;
  route: string | null;
  appVersion: string | null;
  buildId: string | null;
  platform: string | null;
  osVersion: string | null;
  device: string | null;
  screenSize: string | null;
  userAgent: string | null;
  locale: string | null;
  clientErrors: unknown;
  duplicateOfId: string | null;
  externalRef: string | null;
  internalNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

/** Bouwt de Prisma-where uit de filters (gedeeld door lijst en tellers). */
export function buildReportWhere(
  filters: ReportFilters = {}
): Prisma.AppReportWhereInput {
  const where: Prisma.AppReportWhereInput = {};

  if (filters.origin === "lid") {
    // Herkomst is afgeleid van de rol: alleen leden (of anonieme/uitgelogde
    // melders — in de praktijk vrijwel altijd leden) tellen als "lid".
    where.OR = [{ reporterRole: "TENANT_MEMBER" }, { reporterRole: null }];
  } else if (filters.origin === "sportschool") {
    where.reporterRole = { in: GYM_ROLES };
  }

  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.severity) where.severity = filters.severity;
  if (filters.platform) where.platform = filters.platform;
  if (filters.appVersion) where.appVersion = filters.appVersion;
  if (filters.tenantId) where.tenantId = filters.tenantId;

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    };
  }

  const q = filters.search?.trim();
  if (q) {
    const search: Prisma.AppReportWhereInput[] = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { route: { contains: q, mode: "insensitive" } },
      { id: { contains: q, mode: "insensitive" } },
    ];
    // Combineer met een eventuele herkomst-OR via AND.
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: search }];
      delete where.OR;
    } else {
      where.OR = search;
    }
  }

  return where;
}

export type ReportQueryResult = {
  rows: ReportRowData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** Gepagineerde, gefilterde meldingen-query incl. naam-resolutie (geen FK's). */
export async function queryAppReports(
  filters: ReportFilters,
  pageParam = 1,
  pageSize = DEFAULT_PAGE_SIZE
): Promise<ReportQueryResult> {
  const page = Math.max(1, pageParam);
  const size = Math.min(200, Math.max(1, pageSize));
  const where = buildReportWhere(filters);

  const [reports, total] = await Promise.all([
    prisma.appReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * size,
      take: size,
    }),
    prisma.appReport.count({ where }),
  ]);

  const rows = await serializeReportRows(reports);
  return {
    rows,
    total,
    page,
    pageSize: size,
    totalPages: Math.max(1, Math.ceil(total / size)),
  };
}

/** Zet Prisma-rijen om naar de client-veilige vorm (namen batch-gefetcht). */
export async function serializeReportRows(
  reports: AppReport[]
): Promise<ReportRowData[]> {
  const tenantIds = [...new Set(reports.map((r) => r.tenantId).filter(Boolean))] as string[];
  const userIds = [...new Set(reports.map((r) => r.reportedById).filter(Boolean))] as string[];

  const [tenants, users] = await Promise.all([
    tenantIds.length
      ? prisma.tenant.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    userIds.length
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
  ]);
  const tenantName = new Map(tenants.map((t) => [t.id, t.name]));
  const userById = new Map(users.map((u) => [u.id, u]));

  return reports.map((r) => {
    const reporter = r.reportedById ? userById.get(r.reportedById) : undefined;
    return {
      id: r.id,
      ref: `#${r.id.slice(-8).toUpperCase()}`,
      type: r.type,
      status: r.status,
      severity: r.severity,
      origin: reportOrigin(r.reporterRole),
      reporterRole: r.reporterRole,
      reporterName: reporter?.name ?? null,
      reporterEmail: reporter?.email ?? null,
      contactAllowed: r.contactAllowed,
      tenantId: r.tenantId,
      tenantName: r.tenantId ? (tenantName.get(r.tenantId) ?? null) : null,
      title: r.title,
      description: r.description,
      hasScreenshot: Boolean(r.screenshotKey),
      route: r.route,
      appVersion: r.appVersion,
      buildId: r.buildId,
      platform: r.platform,
      osVersion: r.osVersion,
      device: r.device,
      screenSize: r.screenSize,
      userAgent: r.userAgent,
      locale: r.locale,
      clientErrors: r.clientErrors,
      duplicateOfId: r.duplicateOfId,
      externalRef: r.externalRef,
      internalNote: r.internalNote,
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

export type ReportCounters = {
  newToday: number;
  open: number;
  perVersion: { appVersion: string; count: number }[];
};

const OPEN_STATUSES: ReportStatus[] = ["NEW", "TRIAGED", "IN_PROGRESS"];

/** Tellers bovenaan de inbox: nieuw vandaag / open / open per app-versie. */
export async function queryReportCounters(): Promise<ReportCounters> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [newToday, open, perVersionRaw] = await Promise.all([
    prisma.appReport.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.appReport.count({ where: { status: { in: OPEN_STATUSES } } }),
    prisma.appReport.groupBy({
      by: ["appVersion"],
      where: { status: { in: OPEN_STATUSES } },
      _count: { _all: true },
      orderBy: { _count: { appVersion: "desc" } },
      take: 6,
    }),
  ]);

  return {
    newToday,
    open,
    perVersion: perVersionRaw.map((row) => ({
      appVersion: row.appVersion ?? "onbekend",
      count: row._count._all,
    })),
  };
}

/** Distinct waarden voor de filter-selects (platform + app-versie). */
export async function getReportFilterOptions(): Promise<{
  platforms: string[];
  versions: string[];
}> {
  const [platforms, versions] = await Promise.all([
    prisma.appReport.findMany({
      distinct: ["platform"],
      select: { platform: true },
      orderBy: { platform: "asc" },
      take: 20,
    }),
    prisma.appReport.findMany({
      distinct: ["appVersion"],
      select: { appVersion: true },
      orderBy: { appVersion: "desc" },
      take: 50,
    }),
  ]);
  return {
    platforms: platforms.map((p) => p.platform).filter((p): p is string => Boolean(p)),
    versions: versions.map((v) => v.appVersion).filter((v): v is string => Boolean(v)),
  };
}

type RawParams = Record<string, string | undefined>;

/** Vertaalt URL-searchParams naar filters + paginering (filters in de URL). */
export function parseReportSearchParams(sp: RawParams): {
  filters: ReportFilters;
  page: number;
} {
  const filters: ReportFilters = {};
  if (sp.search) filters.search = sp.search;
  if (sp.herkomst === "lid" || sp.herkomst === "sportschool") {
    filters.origin = sp.herkomst;
  }
  if (TYPE_VALUES.includes(sp.type as ReportType)) {
    filters.type = sp.type as ReportType;
  }
  if (STATUS_VALUES.includes(sp.status as ReportStatus)) {
    filters.status = sp.status as ReportStatus;
  }
  if (SEVERITY_VALUES.includes(sp.severity as ReportSeverity)) {
    filters.severity = sp.severity as ReportSeverity;
  }
  if (sp.platform) filters.platform = sp.platform;
  if (sp.version) filters.appVersion = sp.version;
  if (sp.tenant) filters.tenantId = sp.tenant;
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
    page: Math.max(1, Number(sp.page ?? "1") || 1),
  };
}
