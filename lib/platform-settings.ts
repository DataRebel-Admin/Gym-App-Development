import "server-only";
import { prisma } from "@/lib/db";
import {
  parseHeaderStyle,
  serializeHeaderStyle,
  type EmailHeaderStyle,
} from "@/lib/email/header-style";

/**
 * Globale platform-instellingen (key/value) die de Superadmin zonder redeploy
 * kan wijzigen. Gebruikt bewust de base `prisma` — de tabel is globaal (géén
 * tenantId/RLS, zoals AuditLog/EmailTemplate). Nieuwe instelling = één key +
 * een getter/default hieronder.
 */

export const PLATFORM_SETTING_KEYS = {
  supportEmail: "support.email",
  outgoingEmail: "email.outgoing",
  emailHeaderStyle: "email.header.style",
} as const;

/** GymRebel-default; overschrijfbaar via env of via de Superadmin-UI. */
const DEFAULT_SUPPORT_EMAIL = "admin@datarebel.nl";

/** Lees een platform-instelling; `null` als 'ie niet gezet is. */
export async function getPlatformSetting(key: string): Promise<string | null> {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

/** Verwijder een platform-instelling → terug naar de code-standaard. */
export async function clearPlatformSetting(key: string): Promise<void> {
  await prisma.platformSetting.deleteMany({ where: { key } });
}

/** Schrijf (upsert) een platform-instelling met auteur-metadata. */
export async function setPlatformSetting(
  key: string,
  value: string,
  actor?: { id?: string | null; email?: string | null }
): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key },
    update: {
      value,
      updatedById: actor?.id ?? null,
      updatedByEmail: actor?.email ?? null,
    },
    create: {
      key,
      value,
      updatedById: actor?.id ?? null,
      updatedByEmail: actor?.email ?? null,
    },
  });
}

/**
 * Het support-e-mailadres waar contactberichten van sportschooleigenaren
 * naartoe gaan. Resolutie: DB-instelling → `SUPPORT_EMAIL` env → GymRebel-default.
 * Zo eenvoudig aan te passen zonder code-wijziging (Superadmin → Instellingen).
 */
export async function getSupportEmail(): Promise<string> {
  const fromDb = await getPlatformSetting(PLATFORM_SETTING_KEYS.supportEmail);
  const value = fromDb?.trim() || process.env.SUPPORT_EMAIL?.trim();
  return value || DEFAULT_SUPPORT_EMAIL;
}

export async function setSupportEmail(
  email: string,
  actor?: { id?: string | null; email?: string | null }
): Promise<void> {
  await setPlatformSetting(PLATFORM_SETTING_KEYS.supportEmail, email, actor);
}

/**
 * Opmaak van de bovenste balk in álle uitgaande e-mails (zie
 * lib/email/header-style.ts). Eén globale instelling, géén per-tenant waarde:
 * de balk kleurt al per sportschool mee via de `{{accentColor}}`-tokens, dus
 * whitelabel blijft intact zonder dat elke gym eigen CSS hoeft te beheren.
 * Geen rij = de code-standaard.
 */
export async function getEmailHeaderStyle(): Promise<EmailHeaderStyle> {
  return parseHeaderStyle(
    await getPlatformSetting(PLATFORM_SETTING_KEYS.emailHeaderStyle)
  );
}

export async function setEmailHeaderStyle(
  style: EmailHeaderStyle,
  actor?: { id?: string | null; email?: string | null }
): Promise<void> {
  await setPlatformSetting(
    PLATFORM_SETTING_KEYS.emailHeaderStyle,
    serializeHeaderStyle(style),
    actor
  );
}

/** Terug naar de code-standaard: de rij wordt verwijderd, niet overschreven. */
export async function clearEmailHeaderStyle(): Promise<void> {
  await clearPlatformSetting(PLATFORM_SETTING_KEYS.emailHeaderStyle);
}

/**
 * Staat het platform toe daadwerkelijk uitgaande e-mail te versturen?
 * Default `true`. Zet de Superadmin dit op `false`, dan short-circuit
 * `sendEmail` (log naar console, niets de deur uit) — één globale killswitch
 * voor álle transactionele mail, handig tijdens ontwikkeling/testen wanneer
 * echte mail naar admins irritant is. Alleen "off" schakelt uit → een
 * ontbrekende rij betekent gewoon "aan".
 */
export async function getOutgoingEmailEnabled(): Promise<boolean> {
  const raw = await getPlatformSetting(PLATFORM_SETTING_KEYS.outgoingEmail);
  return raw !== "off";
}

export async function setOutgoingEmailEnabled(
  enabled: boolean,
  actor?: { id?: string | null; email?: string | null }
): Promise<void> {
  await setPlatformSetting(
    PLATFORM_SETTING_KEYS.outgoingEmail,
    enabled ? "on" : "off",
    actor
  );
}
