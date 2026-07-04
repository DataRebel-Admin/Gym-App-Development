import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/owner";
import { prisma } from "@/lib/db";
import { machinePublicUrl } from "@/lib/machine";
import { loadLogoDataUri, qrPngBytes, qrStyledSvg, type QrRenderStyle } from "@/lib/qr-export/qr";
import { safeFilename } from "@/lib/qr-export/filename";

// Losse, gestylde QR-download voor één apparaat. Deelt de renderer met de
// bulk-export → pixel-identiek. Tenant-scoped via requireOwner + expliciete filter.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const owner = await requireOwner();

  const machine = await prisma.machine.findFirst({
    where: { id, tenantId: owner.tenantId },
    select: { name: true, qrToken: true },
  });
  if (!machine) return new NextResponse("Not found", { status: 404 });

  const tenant = await prisma.tenant.findUnique({
    where: { id: owner.tenantId },
    select: { slug: true, accentColor: true, logoUrl: true },
  });

  const url = machinePublicUrl(tenant?.slug ?? "", machine.qrToken);
  const format = new URL(req.url).searchParams.get("format") === "svg" ? "svg" : "png";
  const style: QrRenderStyle = {
    accent: tenant?.accentColor ?? null,
    logoDataUri: await loadLogoDataUri(tenant?.logoUrl ?? null),
  };

  const base = `qr-${safeFilename(machine.name) || "apparaat"}`;

  if (format === "svg") {
    return new NextResponse(qrStyledSvg(url, style), {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `attachment; filename="${base}.svg"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const png = qrPngBytes(url, style);
  return new NextResponse(Buffer.from(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${base}.png"`,
      "Cache-Control": "no-store",
    },
  });
}
