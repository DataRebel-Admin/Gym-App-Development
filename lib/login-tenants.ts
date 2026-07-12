import "server-only";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/security";

/**
 * E-mail → sportschool-resolutie voor de subdomein-loze login (app).
 *
 * In de app is er geen subdomein om de tenant te bepalen; die leiden we af uit
 * het e-mailadres. Één persoon kan met hetzelfde e-mailadres bij meerdere
 * sportscholen horen (e-mail is uniek *per tenant*), dus het resultaat kan
 * meerdere opties bevatten → dan volgt een gym-kiezer.
 *
 * **Geen enumeratie**: `findLoginTenantsForEmail` wordt alleen gebruikt voor de
 * magic-link-verzending (het scherm toont altijd "check je mail") en voor het
 * branden van de mail. De on-screen gym-kiezer draait uitsluitend op
 * `matchPasswordAcrossTenants` — die is proof-gated (alleen sportscholen waar het
 * wáchtwoord matcht), zodat een aanvaller zonder wachtwoord niets leert.
 */

export type LoginTenantOption = {
  slug: string;
  name: string;
  logoUrl: string | null;
  role: Role;
};

/** Actieve accounts voor een e-mailadres over actieve, niet-verwijderde tenants. */
export async function findLoginTenantsForEmail(
  emailRaw: string
): Promise<LoginTenantOption[]> {
  const email = emailRaw.toLowerCase().trim();
  if (!email) return [];

  const rows = await prisma.user.findMany({
    where: {
      email,
      active: true,
      tenantId: { not: null },
      tenant: { status: "ACTIVE", deletedAt: null },
    },
    select: {
      role: true,
      tenant: { select: { slug: true, name: true, logoUrl: true } },
    },
    orderBy: { tenant: { name: "asc" } },
  });

  return rows.flatMap((r) =>
    r.tenant
      ? [{ slug: r.tenant.slug, name: r.tenant.name, logoUrl: r.tenant.logoUrl, role: r.role }]
      : []
  );
}

export type MatchedTenantAccount = {
  id: string;
  email: string;
  role: Role;
  tenantId: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
};

/**
 * Sportscholen waar het opgegeven wachtwoord matcht voor dit e-mailadres.
 * Proof-gated: alleen accounts met een geldig wachtwoord komen terug, zodat de
 * gym-kiezer nooit meer prijsgeeft dan de gebruiker (die het wachtwoord kent).
 */
export async function matchPasswordAcrossTenants(
  emailRaw: string,
  password: string
): Promise<MatchedTenantAccount[]> {
  const email = emailRaw.toLowerCase().trim();
  if (!email || !password) return [];

  const rows = await prisma.user.findMany({
    where: {
      email,
      active: true,
      tenantId: { not: null },
      tenant: { status: "ACTIVE", deletedAt: null },
    },
    select: {
      id: true,
      email: true,
      role: true,
      tenantId: true,
      passwordHash: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      tenant: { select: { slug: true, name: true, logoUrl: true } },
    },
  });

  const matched: MatchedTenantAccount[] = [];
  for (const r of rows) {
    if (!r.tenantId || !r.tenant || !r.passwordHash) continue;
    if (await verifyPassword(password, r.passwordHash)) {
      matched.push({
        id: r.id,
        email: r.email,
        role: r.role,
        tenantId: r.tenantId,
        slug: r.tenant.slug,
        name: r.tenant.name,
        logoUrl: r.tenant.logoUrl,
        twoFactorEnabled: r.twoFactorEnabled,
        twoFactorSecret: r.twoFactorSecret,
      });
    }
  }
  return matched;
}
