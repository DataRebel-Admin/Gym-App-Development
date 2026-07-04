import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/staff";
import { getExportGroupForTenant, countMachines } from "@/lib/qr-export/data";
import { buildQrExport, parseExportOptions } from "@/lib/qr-export/respond";
import type { QrExportFilter } from "@/lib/qr-export/types";
import { audit } from "@/lib/audit";
import type { TenantUser } from "@/lib/staff";

// QR-bulkexport voor de tenant-werkruimte. Toegang: eigenaar (passeert altijd)
// of medewerker met `machines:qr-export`. Streamt een PDF of ZIP.
//
// GET (querystring) is handig voor directe links; POST (formulier) draagt grote
// id-selecties in de body → geen URL-lengtelimiet bij honderden apparaten.

async function respond(params: URLSearchParams, user: TenantUser): Promise<NextResponse> {
  const options = parseExportOptions(params);
  const filter: QrExportFilter = {
    type: params.get("type") || undefined,
    location: params.get("location") || undefined,
    status: params.get("status") || undefined,
    ids: params.get("ids") ? params.get("ids")!.split(",").filter(Boolean) : undefined,
  };

  const group = await getExportGroupForTenant(user.tenantId, filter);
  if (!group) return new NextResponse("Sportschool niet gevonden", { status: 404 });

  const count = countMachines([group]);
  if (count === 0) {
    return new NextResponse("Geen apparaten gevonden voor deze selectie", { status: 404 });
  }

  const result = await buildQrExport([group], options, `qr-codes-${group.branding.tenantName}`);

  await audit("machine.qr.export", {
    actor: { id: user.id, email: user.email, role: user.role },
    tenantId: user.tenantId,
    targetType: "Machine",
    metadata: { count, format: options.format },
  });

  return new NextResponse(result.bytes as BodyInit, {
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: Request) {
  const user = await requirePermission("machines:qr-export");
  return respond(new URL(req.url).searchParams, user);
}

export async function POST(req: Request) {
  const user = await requirePermission("machines:qr-export");
  const form = await req.formData();
  const params = new URLSearchParams();
  for (const [k, v] of form.entries()) if (typeof v === "string") params.set(k, v);
  return respond(params, user);
}
