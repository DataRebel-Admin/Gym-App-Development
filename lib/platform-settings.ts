import "server-only";
import { prisma } from "@/lib/db";

/**
 * Globale platform-instellingen (key/value) die de Superadmin zonder redeploy
 * kan wijzigen. Gebruikt bewust de base `prisma` — de tabel is globaal (géén
 * tenantId/RLS, zoals AuditLog/EmailTemplate). Nieuwe instelling = één key +
 * een getter/default hieronder.
 */

export const PLATFORM_SETTING_KEYS = {
  supportEmail: "support.email",
  outgoingEmail: "email.outgoing",
} as const;

/** GymRebel-default; overschrijfbaar via env of via de Superadmin-UI. */
const DEFAULT_SUPPORT_EMAIL = "admin@datarebel.nl";

/** Lees een platform-instelling; `null` als 'ie niet gezet is. */
export async function getPlatformSetting(key: string): Promise<string | null> {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  return row?.value ?? null;
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
