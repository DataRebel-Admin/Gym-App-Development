import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Ondertekende, kortlevende "login-challenge" voor de tweestaps-wachtwoordlogin.
 *
 * Stap 1 (server action) verifieert e-mail + wachtwoord en mint een challenge die
 * bewijst dat het wachtwoord klopt — gebonden aan e-mail + tenant + vervaltijd en
 * ondertekend met AUTH_SECRET. Stap 2 (de aparte 2FA-pagina) hoeft daardoor alleen
 * de TOTP-code te verzamelen; het wachtwoord wordt niet opnieuw verstuurd. De
 * credentials-`authorize` vertrouwt een geldige challenge i.p.v. het wachtwoord.
 *
 * Omdat de challenge HMAC-ondertekend is, kan niemand zonder AUTH_SECRET er één
 * vervalsen — het credentials-endpoint is dus niet te misbruiken om 2FA te omzeilen.
 */

const TTL_MS = 5 * 60 * 1000; // 5 minuten — ruim genoeg om een code in te tikken.

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET ontbreekt — vereist voor login-challenges.");
  return s;
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

type ChallengeClaims = { email: string; tenantId: string | null };

/** Mint een ondertekende challenge voor een geverifieerde gebruiker. */
export function mintLoginChallenge(claims: ChallengeClaims): string {
  const exp = Date.now() + TTL_MS;
  const payload = JSON.stringify({ email: claims.email, tenantId: claims.tenantId, exp });
  const body = Buffer.from(payload, "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Parse zonder verificatie — alleen om de e-mail eruit te halen (bv. om aan
 *  `signIn` mee te geven). De handtekening wordt door verifyLoginChallenge gecheckt. */
export function parseLoginChallenge(token: string): ChallengeClaims | null {
  const body = token.split(".")[0];
  if (!body) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof data?.email !== "string") return null;
    return { email: data.email, tenantId: data.tenantId ?? null };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Gym-keuze-token (multi-gym login zonder subdomein)
 *
 * Als één e-mailadres met een geldig wachtwoord bij meerdere sportscholen hoort,
 * tonen we een gym-kiezer. Dit token draagt — HMAC-ondertekend en kortlevend —
 * het bewijs dat het wachtwoord voor déze tenant-ids al is geverifieerd, zodat de
 * kiezer geen wachtwoord opnieuw hoeft te vragen. Puur server-side (cookie).
 * ------------------------------------------------------------------ */

const SELECTION_TTL_MS = 10 * 60 * 1000; // 10 minuten om een gym te kiezen.

export type TenantSelectionClaims = { email: string; tenantIds: string[] };

/** Mint een ondertekend gym-keuze-token voor de proof-gated tenant-ids. */
export function mintTenantSelection(claims: TenantSelectionClaims): string {
  const exp = Date.now() + SELECTION_TTL_MS;
  const payload = JSON.stringify({
    kind: "sel",
    email: claims.email,
    tenantIds: claims.tenantIds,
    exp,
  });
  const body = Buffer.from(payload, "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Verifieer handtekening + vervaltijd van een gym-keuze-token. */
export function verifyTenantSelection(token: string): TenantSelectionClaims | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const given = Buffer.from(sig);
  const want = Buffer.from(sign(body));
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

  let data: { kind?: unknown; email?: unknown; tenantIds?: unknown; exp?: unknown };
  try {
    data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (data.kind !== "sel") return null;
  if (typeof data.email !== "string") return null;
  if (!Array.isArray(data.tenantIds) || !data.tenantIds.every((t) => typeof t === "string")) {
    return null;
  }
  if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
  return { email: data.email, tenantIds: data.tenantIds as string[] };
}

/** Verifieer handtekening, vervaltijd én binding aan e-mail + tenant. */
export function verifyLoginChallenge(token: string, expect: ChallengeClaims): boolean {
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;

  // Constant-time handtekeningvergelijking.
  const given = Buffer.from(sig);
  const want = Buffer.from(sign(body));
  if (given.length !== want.length || !timingSafeEqual(given, want)) return false;

  let data: { email?: unknown; tenantId?: unknown; exp?: unknown };
  try {
    data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return false;
  }
  if (typeof data.exp !== "number" || data.exp < Date.now()) return false;
  return (
    data.email === expect.email &&
    (data.tenantId ?? null) === (expect.tenantId ?? null)
  );
}
