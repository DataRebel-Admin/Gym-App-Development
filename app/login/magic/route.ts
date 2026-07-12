import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AUTH_TENANT_COOKIE, TENANT_COOKIE_MAX_AGE } from "@/lib/constants";

/**
 * Tenant-doorstuurroute voor multi-gym magic links.
 *
 * Bij een e-mailadres dat bij meerdere sportscholen hoort, verstuurt
 * `sendVerificationRequest` (auth.ts) één gelabelde link per sportschool naar
 * `/login/magic?t=<slug>&u=<Auth.js-callback-url>`. Deze route zet de
 * tenant-cookie op de gekozen sportschool en stuurt daarna door naar de echte
 * Auth.js-verificatie, zodat de tenant-scoped adapter de juiste gebruiker vindt.
 *
 * Veiligheid: `u` moet dezelfde origin + een `/api/auth/`-pad zijn (geen
 * open redirect), en `t` moet een bestaande, actieve tenant zijn.
 */
export async function GET(req: Request) {
  const reqUrl = new URL(req.url);
  const loginUrl = new URL("/login", reqUrl.origin);

  const slug = reqUrl.searchParams.get("t")?.trim() ?? "";
  const rawTarget = reqUrl.searchParams.get("u") ?? "";

  let target: URL;
  try {
    target = new URL(rawTarget);
  } catch {
    return NextResponse.redirect(loginUrl);
  }
  // Alleen doorsturen naar de eigen Auth.js-callback (geen open redirect).
  if (target.origin !== reqUrl.origin || !target.pathname.startsWith("/api/auth/")) {
    return NextResponse.redirect(loginUrl);
  }

  if (!slug) return NextResponse.redirect(loginUrl);
  const tenant = await prisma.tenant.findFirst({
    where: { slug, status: "ACTIVE", deletedAt: null },
    select: { slug: true },
  });
  if (!tenant) return NextResponse.redirect(loginUrl);

  const res = NextResponse.redirect(target);
  res.cookies.set(AUTH_TENANT_COOKIE, tenant.slug, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: TENANT_COOKIE_MAX_AGE,
  });
  return res;
}
