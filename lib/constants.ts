/** Cookie waarin tijdens de login de tenant-slug wordt onthouden, zodat de
 *  tenant-scoped Auth.js-adapter de juiste tenant kan kiezen bij het verifiëren
 *  van de magic link (zie lib/auth-adapter.ts). */
export const AUTH_TENANT_COOKIE = "gymrebel-auth-tenant";

/** Header die de middleware zet met de actieve tenant-slug (prompt 04). */
export const TENANT_HEADER = "x-tenant-slug";

/** Header die de middleware zet met het request-pad, zodat de root-layout
 *  route-afhankelijk kan beslissen (bv. login altijd in lichte modus). */
export const PATHNAME_HEADER = "x-pathname";

/** Fallback-tenant in development wanneer geen subdomein/param aanwezig is. */
export const DEV_FALLBACK_TENANT = "fitpower";

/** Cookie met de ondertekende 2FA-challenge tussen stap 1 (wachtwoord) en stap 2
 *  (code) van de wachtwoord-login. HttpOnly + kortlevend (zie lib/login-challenge.ts). */
export const TWO_FACTOR_CHALLENGE_COOKIE = "gymrebel-2fa-challenge";

/** Cookie waarin de gekozen UI-taal (locale-code: nl/en/fy) wordt onthouden.
 *  Niet-httpOnly zodat de client 'm ook kan lezen; 1 jaar geldig. Gesynchroniseerd
 *  met `User.locale` bij login en bij wisselen (zie lib/i18n). */
export const LOCALE_COOKIE = "gymrebel-locale";
