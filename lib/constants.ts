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

/** Retentie (dagen) van melding-screenshots ná afronding van de melding (AVG);
 *  de reports-retention-cron verwijdert de blob en nult de verwijzing. */
export const REPORT_SCREENSHOT_RETENTION_DAYS = 183;

/** Cookie waarin de gekozen UI-taal (locale-code: nl/en/fy) wordt onthouden.
 *  Niet-httpOnly zodat de client 'm ook kan lezen; 1 jaar geldig. Gesynchroniseerd
 *  met `User.locale` bij login en bij wisselen (zie lib/i18n). */
export const LOCALE_COOKIE = "gymrebel-locale";

/** Kortlevende cookie ("1") die op élk login-afrondpunt gezet wordt (wachtwoord,
 *  2FA, gym-kiezer, passkey, OAuth, magic link) zodat de member-/owner-layout
 *  direct na het inloggen één keer de gebrande splash (gym-logo op accentkleur)
 *  toont. Bewust NIET httpOnly: de client verwijdert 'm zodra de splash getoond
 *  is, anders verschijnt hij opnieuw bij een refresh. */
export const POST_LOGIN_SPLASH_COOKIE = "gymrebel-splash";

/** Opties voor de splash-cookie. 10 minuten: ruim genoeg om een externe
 *  OAuth-roundtrip (incl. MFA bij Microsoft/Google) te overleven, kort genoeg om
 *  nooit te blijven hangen als een loginpoging strandt. Als plain object zodat
 *  zowel `cookies().set` (server action) als `res.cookies.set` (route-response)
 *  'm kan gebruiken. */
export const POST_LOGIN_SPLASH_COOKIE_OPTS = {
  httpOnly: false,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 10,
} as const;

/** Cookie ("on"/"off") waarin de voorkeur staat of de aurora-achtergrond op de
 *  cursor reageert (muis-parallax). Per apparaat — net als het thema — zodat de
 *  root-layout 'm no-flash en zonder DB-lees kan toepassen (lib/background-motion.ts). */
export const BG_PARALLAX_COOKIE = "gymrebel-bg-parallax";

/** Cookie met de per-device gekozen actieve vestiging (Location-id). Onderdeel
 *  van de sessie-locatie-resolutie: expliciete keuze → deze cookie →
 *  User.homeLocationId → default-vestiging (zie lib/location-resolve.ts).
 *  Server-side gevalideerd tegen de actieve vestigingen van de tenant —
 *  een verlopen/vreemde waarde wordt genegeerd. 1 jaar geldig (patroon
 *  AUTH_TENANT_COOKIE). */
export const LOCATION_COOKIE = "gymrebel-location";
