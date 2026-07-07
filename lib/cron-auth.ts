import "server-only";

/**
 * Gedeelde autorisatie voor Vercel Cron-routes. Vereist
 * `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron stuurt die header mee).
 *
 * **Fail-closed in productie**: ontbreekt `CRON_SECRET`, dan wordt de route
 * geweigerd. Een vergeten env-var mag een cron-endpoint (dat schema's publiceert
 * en massa-meldingen stuurt) niet publiek maken. In development (geen productie)
 * mag het zónder secret, zodat lokaal aanroepen blijft werken.
 */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
