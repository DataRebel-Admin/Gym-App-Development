import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { resolveTenantSlug } from "@/lib/tenant-resolve";
import { TENANT_HEADER, PATHNAME_HEADER, AUTH_TENANT_COOKIE } from "@/lib/constants";

// Edge-veilige proxy/middleware: lost de tenant op (subdomein of ?tenant),
// zet die als header voor de Server Components, en dwingt rol-toegang af op
// /member en /owner.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;

  // 1) Tenant-resolutie → header voor downstream Server Components.
  const slug = resolveTenantSlug(
    req.headers.get("host"),
    nextUrl.searchParams.get("tenant"),
    req.cookies.get(AUTH_TENANT_COOKIE)?.value
  );
  const { pathname } = nextUrl;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(TENANT_HEADER, slug);
  requestHeaders.set(PATHNAME_HEADER, pathname);

  // 2) Rol-bescherming.
  const user = req.auth?.user;
  const onAdmin = pathname.startsWith("/admin");
  const onOwner = pathname.startsWith("/owner");
  const onMember = pathname.startsWith("/member");

  if (onAdmin || onOwner || onMember) {
    if (!user) {
      const loginUrl = new URL("/login", nextUrl);
      loginUrl.searchParams.set("callbackUrl", nextUrl.href);
      loginUrl.searchParams.set("tenant", slug);
      return NextResponse.redirect(loginUrl);
    }
    // Onbekende/verouderde rol (bv. een oude cookie met de oude rolnamen
    // OWNER/MEMBER van vóór de hernoeming) → terug naar /login i.p.v. eindeloos
    // bouncen tussen /owner en /member. Breekt de redirect-loop.
    const KNOWN_ROLES = ["SUPERADMIN", "TENANT_ADMIN", "TENANT_MEMBER"];
    if (!KNOWN_ROLES.includes(user.role as string)) {
      const loginUrl = new URL("/login", nextUrl);
      loginUrl.searchParams.set("tenant", slug);
      return NextResponse.redirect(loginUrl);
    }
    // SUPERADMIN hoort op /admin; weg uit tenant-areas (voorkomt redirect-loop).
    if (onAdmin && user.role !== "SUPERADMIN") {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    if (user.role === "SUPERADMIN" && (onOwner || onMember)) {
      return NextResponse.redirect(new URL("/admin", nextUrl));
    }
    if (onOwner && user.role !== "TENANT_ADMIN") {
      return NextResponse.redirect(new URL("/member", nextUrl));
    }
    if (onMember && user.role !== "TENANT_MEMBER") {
      return NextResponse.redirect(new URL("/owner", nextUrl));
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
