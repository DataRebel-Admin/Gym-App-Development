import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";
import { getExportGroupForTenant } from "@/lib/qr-export/data";
import { buildQrExport, parseExportOptions } from "@/lib/qr-export/respond";
import type { QrExportFilter, QrExportGroup } from "@/lib/qr-export/types";
import { audit } from "@/lib/audit";

// QR-bulkexport voor de superadmin: één gekozen tenant of alle tenants
// (`tenantId=all`). Cross-tenant toegestaan achter de superadmin-guard.
// GET (link) + POST (grote id-selectie in de body) delen dezelfde logica.

type Admin = Awaited<ReturnType<typeof requireSuperadmin>>;

async function respond(params: URLSearchParams, admin: Admin): Promise<NextResponse> {
  const options = parseExportOptions(params);
  const tenantParam = params.get("tenantId") || "";
  if (!tenantParam) return new NextResponse("Kies een sportschool", { status: 400 });

  const filter: QrExportFilter = {
    type: params.get("type") || undefined,
    location: params.get("location") || undefined,
    status: params.get("status") || undefined,
    ids:
      tenantParam !== "all" && params.get("ids")
        ? params.get("ids")!.split(",").filter(Boolean)
        : undefined,
  };

  // Tenant-ids resolven (met tenantId-associatie voor de audit).
  let tenantIds: string[];
  if (tenantParam === "all") {
    const tenants = await prisma.tenant.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true },
    });
    tenantIds = tenants.map((t) => t.id);
  } else {
    tenantIds = [tenantParam];
  }

  const groups: QrExportGroup[] = [];
  let total = 0;
  for (const id of tenantIds) {
    const group = await getExportGroupForTenant(id, filter);
    if (!group || group.machines.length === 0) continue;
    groups.push(group);
    total += group.machines.length;
    await audit("machine.qr.export", {
      actor: { id: admin.id, email: admin.email, role: admin.role },
      tenantId: id,
      targetType: "Machine",
      metadata: { count: group.machines.length, format: options.format },
    });
  }

  if (total === 0) {
    return new NextResponse("Geen apparaten gevonden voor deze selectie", { status: 404 });
  }

  const baseName =
    tenantParam === "all" ? "qr-codes-alle-tenants" : `qr-codes-${groups[0].branding.tenantName}`;
  const result = await buildQrExport(groups, options, baseName);

  return new NextResponse(result.bytes as BodyInit, {
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: Request) {
  const admin = await requireSuperadmin();
  return respond(new URL(req.url).searchParams, admin);
}

export async function POST(req: Request) {
  const admin = await requireSuperadmin();
  const form = await req.formData();
  const params = new URLSearchParams();
  for (const [k, v] of form.entries()) if (typeof v === "string") params.set(k, v);
  return respond(params, admin);
}
