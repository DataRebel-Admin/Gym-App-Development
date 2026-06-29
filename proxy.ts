import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { resolveTenantSlug } from "@/lib/tenant-resolve";
import { TENANT_HEADER } from "@/lib/constants";

// Edge-veilige proxy/middleware: lost de tenant op (subdomein of ?tenant),
// zet die als header voor de Server Components, en dwingt rol-toegang af op
// /member en /owner.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;

  // 1) Tenant-resolutie → header voor downstream Server Components.
  const slug = resolveTenantSlug(
    req.headers.get("host"),
    nextUrl.searchParams.get("tenant")
  );
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(TENANT_HEADER, slug);

  // 2) Rol-bescherming.
  const user = req.auth?.user;
  const { pathname } = nextUrl;
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
