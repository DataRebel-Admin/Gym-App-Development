import "server-only";
import { prisma } from "@/lib/db";

/**
 * Centrale check op de meldingsvoorkeuren (`User.notificationPrefs`). Eén bron
 * van waarheid zodat verzendpaden kunnen respecteren wat de gebruiker onder
 * /account/meldingen heeft ingesteld (per categorie × kanaal).
 *
 * Belangrijk: kritieke auth-/verificatiemails (magic link, e-mailverificatie)
 * lopen hier bewust NIET langs — die mag een gebruiker niet kunnen uitzetten.
 */
export type NotificationCategory =
  | "new_members"
  | "invitations"
  | "schemas"
  | "changes"
  | "system"
  | "news"
  | "security";

export type NotificationChannel = "email" | "inApp" | "push";

/** Standaardwaarden — gelijk aan de UI (`notifications-form.tsx`). */
export const NOTIFICATION_DEFAULTS: Record<NotificationChannel, boolean> = {
  email: true,
  inApp: true,
  push: false,
};

type PrefsShape = Record<string, Partial<Record<NotificationChannel, boolean>>>;

/**
 * Pure check (zonder DB) — bruikbaar als je de prefs al hebt opgehaald.
 * Onbekende/ontbrekende waarden vallen terug op de standaard van het kanaal.
 */
export function prefAllows(
  prefs: unknown,
  category: NotificationCategory,
  channel: NotificationChannel
): boolean {
  const fallback = NOTIFICATION_DEFAULTS[channel];
  if (!prefs || typeof prefs !== "object") return fallback;
  const row = (prefs as PrefsShape)[category];
  if (!row || typeof row !== "object") return fallback;
  const value = row[channel];
  return typeof value === "boolean" ? value : fallback;
}

/** Mag deze gebruiker een melding van (categorie, kanaal) ontvangen? */
export async function shouldNotify(
  userId: string,
  category: NotificationCategory,
  channel: NotificationChannel
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPrefs: true },
  });
  return prefAllows(user?.notificationPrefs, category, channel);
}

/**
 * Variant voor verzendpaden die alleen een e-mailadres + tenant hebben (bv. de
 * uitnodigingsflow). Bestaat er nog geen account voor dat adres, dan gelden de
 * standaardwaarden (melding wel versturen) — een nieuw lid heeft nog geen
 * voorkeuren ingesteld.
 */
export async function shouldNotifyByEmail(
  tenantId: string,
  email: string,
  category: NotificationCategory,
  channel: NotificationChannel = "email"
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email } },
    select: { notificationPrefs: true },
  });
  return prefAllows(user?.notificationPrefs, category, channel);
}
