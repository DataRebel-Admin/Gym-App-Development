import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";
import { parseAuditSearchParams, queryAuditLogsForExport } from "@/lib/audit-query";
import { auditRowsToCsv, buildAuditPdf } from "@/lib/audit-export";

export async function GET(req: NextRequest) {
  await requireSuperadmin();
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const { filters, tenantParam } = parseAuditSearchParams(sp);
  const format = sp.format === "pdf" ? "pdf" : "csv";

  const [logs, tenants] = await Promise.all([
    queryAuditLogsForExport(tenantParam, filters),
    prisma.tenant.findMany({ select: { id: true, name: true } }),
  ]);
  const tenantName = new Map(tenants.map((t) => [t.id, t.name]));
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "pdf") {
    const pdf = await buildAuditPdf(logs, {
      title: "Audit log — platform",
      tenantName,
      showTenant: true,
    });
    return new NextResponse(pdf as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="audit-log-platform-${stamp}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const csv = auditRowsToCsv(logs, tenantName);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-platform-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
