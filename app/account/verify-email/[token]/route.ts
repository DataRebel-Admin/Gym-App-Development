import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

/** Bevestig een e-mailwijziging via de token-link uit de verificatiemail. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const base = new URL(req.url).origin;

  const user = await prisma.user.findUnique({
    where: { emailChangeToken: token },
    select: {
      id: true,
      email: true,
      pendingEmail: true,
      emailChangeExpires: true,
      tenantId: true,
      role: true,
    },
  });

  const invalid =
    !user ||
    !user.pendingEmail ||
    !user.emailChangeExpires ||
    user.emailChangeExpires < new Date();
  if (invalid) {
    return NextResponse.redirect(new URL("/account?email=invalid", base));
  }

  // Uniciteit opnieuw checken op het moment van bevestigen.
  const clash = user.tenantId
    ? await prisma.user.findUnique({
        where: { tenantId_email: { tenantId: user.tenantId, email: user.pendingEmail! } },
      })
    : await prisma.user.findFirst({ where: { email: user.pendingEmail!, tenantId: null } });
  if (clash && clash.id !== user.id) {
    return NextResponse.redirect(new URL("/account?email=taken", base));
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      email: user.pendingEmail!,
      pendingEmail: null,
      emailChangeToken: null,
      emailChangeExpires: null,
      emailVerified: new Date(),
    },
  });

  await audit("email.change.confirmed", {
    actor: { id: user.id, email: user.pendingEmail, role: user.role },
    tenantId: user.tenantId ?? null,
    targetType: "User",
    targetId: user.id,
    metadata: { from: user.email, to: user.pendingEmail },
  });

  return NextResponse.redirect(new URL("/account?email=changed", base));
}
