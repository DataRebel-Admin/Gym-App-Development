/** Cookie waarin tijdens de login de tenant-slug wordt onthouden, zodat de
 *  tenant-scoped Auth.js-adapter de juiste tenant kan kiezen bij het verifiëren
 *  van de magic link (zie lib/auth-adapter.ts). */
export const AUTH_TENANT_COOKIE = "gymrebel-auth-tenant";

/** Header die de middleware zet met de actieve tenant-slug (prompt 04). */
export const TENANT_HEADER = "x-tenant-slug";

/** Fallback-tenant in development wanneer geen subdomein/param aanwezig is. */
export const DEV_FALLBACK_TENANT = "fitpower";
