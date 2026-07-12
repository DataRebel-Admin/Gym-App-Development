/** Cookie waarin tijdens de login de tenant-slug wordt onthouden, zodat de
 *  tenant-scoped Auth.js-adapter de juiste tenant kan kiezen bij het verifiëren
 *  van de magic link (zie lib/auth-adapter.ts). In de app (geen subdomein) is
 *  deze cookie ook ná login de tenant-context waarop de proxy terugvalt — daarom
 *  duurzaam gezet met TENANT_COOKIE_MAX_AGE. */
export const AUTH_TENANT_COOKIE = "gymrebel-auth-tenant";

/** Levensduur van de tenant-context-cookie (1 jaar). Bewust lang zodat de app
 *  na login zonder subdomein de tenant blijft resolven; wordt bij elke login
 *  opnieuw (op basis van het e-mailadres) gezet, dus een oude waarde blijft nooit
 *  "hangen". */
export const TENANT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Cookie met de ondertekende gym-keuze-token tussen de wachtwoord-check en de
 *  gym-kiezer (`/login/gym`), voor leden die met hetzelfde e-mailadres bij
 *  meerdere sportscholen horen. HttpOnly + kortlevend (zie lib/login-challenge.ts). */
export const GYM_SELECT_COOKIE = "gymrebel-gym-select";

/** Header die de middleware zet met de actieve tenant-slug (prompt 04). */
export const TENANT_HEADER = "x-tenant-slug";

/** Header die de middleware zet met het request-pad, zodat de root-layout
 *  route-afhankelijk kan beslissen (bv. login altijd in lichte modus). */
export const PATHNAME_HEADER = "x-pathname";

/** Fallback-tenant in development wanneer geen subdomein/param aanwezig is. */
export const DEV_FALLBACK_TENANT = "gymrebel";

/** Cookie met de ondertekende 2FA-challenge tussen stap 1 (wachtwoord) en stap 2
 *  (code) van de wachtwoord-login. HttpOnly + kortlevend (zie lib/login-challenge.ts). */
export const TWO_FACTOR_CHALLENGE_COOKIE = "gymrebel-2fa-challenge";

/** Uitstelperiode (dagen) tussen een in-app verwijderverzoek en de definitieve,
 *  automatische verwijdering door de cron. Geeft de gebruiker een annuleervenster
 *  en voldoet aan Apple 5.1.1(v) (in-app, self-service, zonder admin-tussenstap). */
export const ACCOUNT_DELETION_GRACE_DAYS = 30;

/** Cookie waarin de gekozen UI-taal (locale-code: nl/en/fy) wordt onthouden.
 *  Niet-httpOnly zodat de client 'm ook kan lezen; 1 jaar geldig. Gesynchroniseerd
 *  met `User.locale` bij login en bij wisselen (zie lib/i18n). */
export const LOCALE_COOKIE = "gymrebel-locale";
