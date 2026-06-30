import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/owner";
import { parseAuditSearchParams, queryAuditLogsForExport } from "@/lib/audit-query";
import { auditRowsToCsv, buildAuditPdf } from "@/lib/audit-export";

export async function GET(req: NextRequest) {
  const owner = await requireOwner();
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const { filters } = parseAuditSearchParams(sp);
  const format = sp.format === "pdf" ? "pdf" : "csv";

  const logs = await queryAuditLogsForExport(owner.tenantId, filters);
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "pdf") {
    const pdf = await buildAuditPdf(logs, { title: "Audit log" });
    return new NextResponse(pdf as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="audit-log-${stamp}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const csv = auditRowsToCsv(logs);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
