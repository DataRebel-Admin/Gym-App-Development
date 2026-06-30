import "server-only";
import { prisma } from "@/lib/db";

/**
 * Genormaliseerde huisstijl voor e-mails. Elke uitgaande mail wordt met dit
 * object opgebouwd zodat de layout per tenant kleurt (logo, accent, secundair,
 * lettertype, naam, contactgegevens) — met nette GymRebel-defaults als fallback.
 */
export type EmailBranding = {
  name: string;
  logoUrl: string | null;
  accent: string; // primaire kleur (hex)
  accentText: string; // leesbare tekstkleur óp het accent (#fff of #111)
  secondary: string; // secundaire kleur (hex)
  fontStack: string; // CSS font-family voor de mail-body
  website: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null; // samengevoegd: straat, postcode plaats
  socials: { label: string; url: string }[];
  locale: "NL" | "EN" | "FY";
};

/** GymRebel-default accent (gelijk aan app/globals.css → --tenant-accent). */
const DEFAULT_ACCENT = "#e84b1f";
const DEFAULT_FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Structurele invoer (subset van het Tenant-model) zodat we niet de hele
 *  Prisma-Tenant met al z'n relaties hoeven mee te geven. */
export type TenantBrandingInput = {
  name: string;
  logoUrl: string | null;
  accentColor: string | null;
  secondaryColor: string | null;
  fontFamily: string | null;
  website: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  socials: unknown;
  locale: "NL" | "EN" | "FY";
};

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};

/** Valideer een hex-kleur (#rgb of #rrggbb); anders null. */
function hex(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : null;
}

/** Relatieve luminantie → kies wit of donkergrijs voor maximale leesbaarheid. */
export function readableText(bg: string): string {
  const h = bg.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.55 ? "#111827" : "#ffffff";
}

/** Parse de Tenant.socials Json veilig naar een lijst van { label, url }. */
function parseSocials(raw: unknown): { label: string; url: string }[] {
  if (!raw || typeof raw !== "object") return [];
  const out: { label: string; url: string }[] = [];
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim()) {
      out.push({ label: SOCIAL_LABELS[key] ?? key, url: value.trim() });
    }
  }
  return out;
}

/** Bouw een EmailBranding uit een tenant (of de GymRebel-default bij null). */
export function resolveEmailBranding(
  tenant: TenantBrandingInput | null
): EmailBranding {
  const accent = hex(tenant?.accentColor) ?? DEFAULT_ACCENT;
  const address =
    [tenant?.addressLine, [tenant?.postalCode, tenant?.city].filter(Boolean).join(" ")]
      .filter((part) => part && part.trim())
      .join(", ") || null;

  return {
    name: tenant?.name?.trim() || "GymRebel",
    logoUrl: tenant?.logoUrl?.trim() || null,
    accent,
    accentText: readableText(accent),
    secondary: hex(tenant?.secondaryColor) ?? accent,
    fontStack: tenant?.fontFamily?.trim()
      ? `${tenant.fontFamily.trim()}, ${DEFAULT_FONT}`
      : DEFAULT_FONT,
    website: tenant?.website?.trim() || null,
    contactEmail: tenant?.contactEmail?.trim() || null,
    contactPhone: tenant?.contactPhone?.trim() || null,
    address,
    socials: parseSocials(tenant?.socials),
    locale: tenant?.locale ?? "NL",
  };
}

/**
 * Laad de huisstijl voor een tenant-id. Gebruikt bewust de base `prisma`
 * (de Tenant-tabel heeft geen RLS, net als de auth-adapter). `null` → default.
 */
export async function loadTenantBranding(
  tenantId: string | null | undefined
): Promise<EmailBranding> {
  if (!tenantId) return resolveEmailBranding(null);
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true,
      logoUrl: true,
      accentColor: true,
      secondaryColor: true,
      fontFamily: true,
      website: true,
      contactEmail: true,
      contactPhone: true,
      addressLine: true,
      postalCode: true,
      city: true,
      socials: true,
      locale: true,
    },
  });
  return resolveEmailBranding(tenant);
}

/** Laad de huisstijl via tenant-slug (bv. magic link uit de login-cookie). */
export async function loadTenantBrandingBySlug(
  slug: string | null | undefined
): Promise<EmailBranding> {
  if (!slug) return resolveEmailBranding(null);
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: {
      name: true,
      logoUrl: true,
      accentColor: true,
      secondaryColor: true,
      fontFamily: true,
      website: true,
      contactEmail: true,
      contactPhone: true,
      addressLine: true,
      postalCode: true,
      city: true,
      socials: true,
      locale: true,
    },
  });
  return resolveEmailBranding(tenant);
}
