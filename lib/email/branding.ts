import "server-only";
import { prisma } from "@/lib/db";
import { readableText } from "@/lib/color";
import { toAbsoluteUrl } from "@/lib/app-url";

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
const DEFAULT_ACCENT = "#ff4d00";

/**
 * Het GymRebel-woordmerk voor de mailheader. **PNG, geen SVG**: Gmail en Outlook
 * weigeren SVG in `<img>`. Full-color (charcoal + oranje), want het logo staat
 * in de mailheader op een witte badge (zie `renderEmailLayout`). Wordt door
 * `npm run brand:assets` gegenereerd en hieronder absoluut gemaakt.
 */
const PLATFORM_LOGO_PATH = "/brand/gymrebel-logo-email.png";

/**
 * E-mailclients tonen niet elk beeldformaat of adres:
 * - Gmail en Outlook weigeren **SVG** in `<img>` (gebroken-afbeelding-icoon);
 * - Gmail blokkeert **`data:`-URL's** (die ontstaan lokaal als een logo-upload
 *   zonder Blob-token draait);
 * - een **localhost-URL** (dev: `APP_BASE_URL=http://localhost:3001` maakt een
 *   relatief `/brand/…`-pad daarmee absoluut) is vanuit een mailbox per
 *   definitie onbereikbaar — de mail wordt op jouw machine gebouwd maar in
 *   Gmail/Outlook gelezen.
 * Zo'n logo laten we bewust weg — de layout valt dan terug op de tekst-wordmark,
 * die altijd rendert. Liever geen logo dan een gebroken afbeelding.
 */
function isEmailSafeImage(url: string): boolean {
  if (/^data:/i.test(url)) return false;
  const path = url.split(/[?#]/)[0] ?? "";
  if (/\.svg$/i.test(path)) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "[::1]" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local")
    ) {
      return false;
    }
  } catch {
    return false; // geen parsebare absolute URL → niet bruikbaar in een mail
  }
  return true;
}

/**
 * Het logo voor de mailheader.
 *
 * - **Platformmail** (geen tenant): GymRebel is zélf de afzender → het eigen
 *   woordmerk in plaats van de tekstvariant.
 * - **Tenant zónder logo**: bewust `null` → de layout zet de sportschoolnaam als
 *   tekst-wordmark. Hier het GymRebel-logo tonen zou de whitelabel-belofte breken.
 * - Relatieve paden worden absoluut gemaakt: in een mailbox bestaat `/brand/…`
 *   niet. Dat gold ook voor de demo-tenant, die een `/brand/…`-logo heeft.
 * - SVG-/data-logo's vallen terug op de tekst-wordmark (`isEmailSafeImage`).
 */
function emailLogoUrl(tenant: TenantBrandingInput | null): string | null {
  const url = toAbsoluteUrl(tenant ? tenant.logoUrl : PLATFORM_LOGO_PATH);
  return url && isEmailSafeImage(url) ? url : null;
}
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
    logoUrl: emailLogoUrl(tenant),
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
