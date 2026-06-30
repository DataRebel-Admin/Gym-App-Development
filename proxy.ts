import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { resolveTenantSlug } from "@/lib/tenant-resolve";
import {
  TENANT_HEADER,
  PATHNAME_HEADER,
  AUTH_TENANT_COOKIE,
  LOCALE_COOKIE,
} from "@/lib/constants";
import { localeFromEnum } from "@/lib/i18n/config";

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
    const KNOWN_ROLES = ["SUPERADMIN", "TENANT_ADMIN", "TENANT_STAFF", "TENANT_MEMBER"];
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
    // /owner is een gedeelde tenant-werkruimte: eigenaar én medewerker mogen erin.
    // Per-pagina permissie-gating gebeurt server-side (lib/staff.ts).
    if (onOwner && user.role !== "TENANT_ADMIN" && user.role !== "TENANT_STAFF") {
      return NextResponse.redirect(new URL("/member", nextUrl));
    }
    if (onMember && user.role !== "TENANT_MEMBER") {
      return NextResponse.redirect(new URL("/owner", nextUrl));
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // 3) Taal-sync: heeft de ingelogde gebruiker een persoonlijke taalvoorkeur
  //    maar nog geen locale-cookie (eerste request na login via magic link /
  //    OAuth / wachtwoord), zet 'm dan zodat de UI in de juiste taal laadt.
  //    De switcher en de profielpagina blijven de cookie daarna beheren.
  if (user?.locale && !req.cookies.get(LOCALE_COOKIE)) {
    response.cookies.set(LOCALE_COOKIE, localeFromEnum(user.locale), {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
      httpOnly: false,
    });
  }

  return response;
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
