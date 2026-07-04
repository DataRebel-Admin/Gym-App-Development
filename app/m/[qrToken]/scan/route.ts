import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { getCurrentTenant } from "@/lib/tenant";

// Registreert één QR-scan (aangeroepen door de client-beacon op /m/[qrToken]).
// Best-effort: mag een bezoeker nooit blokkeren. Tenant-scoped: de QR telt alleen
// mee bij de actieve sportschool. Bots/link-previews draaien geen JS → tellen niet.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ qrToken: string }> },
) {
  const { qrToken } = await params;
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) return new NextResponse(null, { status: 204 });

    const machine = await prisma.machine.findFirst({
      where: { qrToken, tenantId: tenant.id },
      select: { id: true },
    });
    if (!machine) return new NextResponse(null, { status: 204 });

    // Ingelogd lid van deze tenant → koppel de scan; anders anoniem.
    const session = await auth();
    const userId =
      session?.user?.role === "TENANT_MEMBER" && session.user.tenantId === tenant.id
        ? session.user.id
        : null;

    await prisma.$transaction([
      prisma.machine.update({
        where: { id: machine.id },
        data: { scanCount: { increment: 1 }, lastScannedAt: new Date() },
      }),
      prisma.machineScan.create({
        data: { tenantId: tenant.id, machineId: machine.id, userId },
      }),
    ]);
  } catch {
    // Slikken — tracking mag de scan-ervaring nooit breken.
  }
  return new NextResponse(null, { status: 204 });
}
