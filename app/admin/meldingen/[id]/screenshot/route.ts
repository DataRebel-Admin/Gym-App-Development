import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/superadmin";
import { prisma } from "@/lib/db";

// Beschermde screenshot-proxy: de blob-URL (screenshotKey) verlaat de server
// nooit. De superadmin-UI toont <img src="/admin/meldingen/[id]/screenshot">;
// deze route haalt de blob server-side op en streamt hem door. Privé genoeg
// zonder signed URLs: onraadbare blob-key + toegangscontrole hier.
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  await requireSuperadmin();
  const { id } = await params;

  const report = await prisma.appReport.findUnique({
    where: { id },
    select: { screenshotKey: true },
  });
  if (!report?.screenshotKey) {
    return new NextResponse("Geen screenshot", { status: 404 });
  }

  try {
    const upstream = await fetch(report.screenshotKey);
    if (!upstream.ok || !upstream.body) {
      return new NextResponse("Screenshot niet beschikbaar", { status: 502 });
    }
    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/png",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Screenshot niet beschikbaar", { status: 502 });
  }
}
