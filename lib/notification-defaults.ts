/**
 * Meldingscategorieën, kanalen en hun standaardwaarden.
 *
 * Bewust **puur** (géén `server-only`), zodat zowel de verzendpaden als het
 * voorkeurenformulier (`app/account/meldingen/notifications-form.tsx`) dezelfde
 * bron gebruiken. Idioom van `lib/push-channels.ts` en `lib/exercise-types.ts`.
 *
 * Dat is niet cosmetisch: de standaardwaarden stonden eerder dubbel, in
 * `lib/notifications.ts` (server) en nogmaals in het formulier (client). Toen de
 * server-standaard voor push wijzigde, toonde het formulier nog "uit" terwijl er
 * wél verstuurd werd. Eén bron, geen drift.
 */

export type NotificationCategory =
  | "new_members"
  /**
   * Behouden voor reeds opgeslagen voorkeuren, maar stuurt niets meer aan: een
   * uitnodiging is transactioneel en loopt sinds `createInvitation` bewust langs
   * deze check heen (zie de toelichting daar). Niet opnieuw als gate gebruiken.
   */
  | "invitations"
  | "schemas"
  | "classes"
  | "changes"
  | "achievements"
  | "maintenance"
  | "defects"
  | "system"
  | "news"
  | "security";

export type NotificationChannel = "email" | "inApp" | "push";

/**
 * Standaardwaarden per kanaal (categorie-onafhankelijk).
 *
 * **Push staat standaard AAN.** Dit is een trainingsapp: een schema dat
 * klaarstaat of een les die verplaatst is, is precies waarvoor iemand de app
 * installeert. Stond push standaard uit, dan moest elk lid dat eerst opzoeken in
 * de instellingen, en dat doet vrijwel niemand.
 *
 * Dat is verdedigbaar omdat het besturingssysteem de échte poort is: zonder
 * toestemming op het toestel wordt er niets bezorgd, ongeacht wat hier staat.
 * Deze schakelaars bepalen alleen wélke soorten je krijgt zodra je die
 * toestemming hebt gegeven. Uitzetten kan per categorie hieronder, per kanaal in
 * Android (zie `lib/push-channels.ts`) en systeembreed op het toestel.
 */
export const NOTIFICATION_DEFAULTS: Record<NotificationChannel, boolean> = {
  email: false,
  inApp: true,
  push: true,
};

/**
 * Categorieën waarvoor e-mail standaard AAN staat. Voor alle overige categorieën
 * staat e-mail standaard uit — de gebruiker kan het per categorie aanzetten onder
 * /account/meldingen. In-app en push volgen {@link NOTIFICATION_DEFAULTS}.
 *
 * `classes` staat aan omdat de gevolgen-meldingen (wachtlijst-promotie,
 * verplaatsing, annulering) tijdkritisch zijn: wie ze alleen in-app krijgt en de
 * app niet opent, staat onwetend als no-show op een les.
 */
export const EMAIL_ON_BY_DEFAULT: ReadonlySet<NotificationCategory> = new Set([
  "schemas",
  "classes",
]);

/** De standaardwaarde voor een (categorie × kanaal). */
export function notificationDefault(
  category: NotificationCategory,
  channel: NotificationChannel
): boolean {
  if (channel === "email") return EMAIL_ON_BY_DEFAULT.has(category);
  return NOTIFICATION_DEFAULTS[channel];
}
