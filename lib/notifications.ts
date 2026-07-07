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
  | "achievements"
  | "maintenance"
  | "system"
  | "news"
  | "security";

export type NotificationChannel = "email" | "inApp" | "push";

/** Standaardwaarden per kanaal (categorie-onafhankelijk). */
export const NOTIFICATION_DEFAULTS: Record<NotificationChannel, boolean> = {
  email: false,
  inApp: true,
  push: false,
};

/**
 * Categorieën waarvoor e-mail standaard AAN staat. Voor alle overige categorieën
 * staat e-mail standaard uit — de gebruiker kan het per categorie aanzetten onder
 * /account/meldingen. In-app en push volgen `NOTIFICATION_DEFAULTS`.
 */
const EMAIL_ON_BY_DEFAULT: ReadonlySet<NotificationCategory> = new Set(["schemas"]);

/** De standaardwaarde voor een (categorie × kanaal) — gespiegeld in de UI (`notifications-form.tsx`). */
export function notificationDefault(
  category: NotificationCategory,
  channel: NotificationChannel
): boolean {
  if (channel === "email") return EMAIL_ON_BY_DEFAULT.has(category);
  return NOTIFICATION_DEFAULTS[channel];
}

type PrefsShape = Record<string, Partial<Record<NotificationChannel, boolean>>>;

/**
 * Pure check (zonder DB) — bruikbaar als je de prefs al hebt opgehaald.
 * Onbekende/ontbrekende waarden vallen terug op de standaard van (categorie × kanaal).
 */
export function prefAllows(
  prefs: unknown,
  category: NotificationCategory,
  channel: NotificationChannel
): boolean {
  const fallback = notificationDefault(category, channel);
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

// --- In-app meldingen --------------------------------------------------------

type InAppInput = {
  userId: string;
  tenantId: string | null;
  category: NotificationCategory;
  title: string;
  body?: string | null;
  link?: string | null;
};

/**
 * Maakt direct een in-app melding aan, **zonder** voorkeurs-check — voor
 * verzendpaden die de prefs al hebben opgehaald (gate dan zelf met `prefAllows`,
 * kanaal "inApp"). Faalt nooit hard.
 */
export async function createInAppNotification(input: InAppInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        tenantId: input.tenantId,
        category: input.category,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
      },
    });
  } catch (err) {
    console.error("[notifications] kon in-app melding niet aanmaken:", err);
  }
}

/**
 * Maakt een in-app melding aan mits de gebruiker het in-app-kanaal voor deze
 * categorie aan heeft staan. Voor call-sites die de prefs nog niet hebben.
 */
export async function notifyInApp(input: InAppInput): Promise<void> {
  if (!(await shouldNotify(input.userId, input.category, "inApp"))) return;
  await createInAppNotification(input);
}

export type NotificationItem = {
  id: string;
  category: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

/** Ongelezen-teller + recente meldingen voor de bel in de navigatie. */
export async function getNotificationOverview(
  userId: string,
  take = 15
): Promise<{ unreadCount: number; items: NotificationItem[] }> {
  const [unreadCount, rows] = await Promise.all([
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        category: true,
        title: true,
        body: true,
        link: true,
        readAt: true,
        createdAt: true,
      },
    }),
  ]);
  return {
    unreadCount,
    items: rows.map((r) => ({
      id: r.id,
      category: r.category,
      title: r.title,
      body: r.body,
      link: r.link,
      read: r.readAt !== null,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
