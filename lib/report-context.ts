// Automatisch meegestuurde context bij een app-melding (probleem melden aan de
// developers). Puur — géén `server-only` en géén `"use client"` — zodat de
// client (formulier-samenvatting), de server (POST /api/reports) én de tests
// (tsx --test, relatieve import) exact dezélfde whitelist gebruiken.
//
// Principe: WHITELIST, geen blacklist. Alleen de sleutels in
// `REPORT_CONTEXT_KEYS` overleven `sanitizeReportContext`; al het andere
// (tokens, cookies, headers, request-bodies, wat een aanvaller ook meestuurt)
// valt weg. Daarbovenop een defense-in-depth-scrub die secret-achtige
// substrings uit vrije tekst (stacktraces, error-messages) verwijdert.

/** Eén opgevangen client-side error uit de ringbuffer. */
export type ClientErrorEntry = {
  message: string;
  /** Bron, bv. "bestand.js:42" of "unhandledrejection". */
  source?: string;
  stack?: string;
  /** ISO-tijdstip van opvangen. */
  at?: string;
};

/** De technische context die (na sanering) met een melding wordt meegestuurd. */
export type ReportContext = {
  route?: string;
  appVersion?: string;
  buildId?: string;
  platform?: string; // web | ios | android
  osVersion?: string;
  device?: string;
  screenSize?: string;
  userAgent?: string;
  locale?: string;
  clientErrors?: ClientErrorEntry[];
};

/** De whitelist: alléén deze sleutels komen door de sanering heen. */
export const REPORT_CONTEXT_KEYS = [
  "route",
  "appVersion",
  "buildId",
  "platform",
  "osVersion",
  "device",
  "screenSize",
  "userAgent",
  "locale",
  "clientErrors",
] as const satisfies readonly (keyof ReportContext)[];

/** Maximaal aantal client-errors dat meegaat. */
export const MAX_CLIENT_ERRORS = 5;

// Lengtelimieten per veld (vrije tekst wordt afgekapt, nooit geweigerd).
const MAX_FIELD_LENGTH = 500;
const MAX_STACK_LENGTH = 2000;

// Defense-in-depth: secret-achtige substrings in vrije tekst (een stacktrace
// kan een URL met token bevatten). De whitelist houdt al hele velden tegen;
// dit schoont wat er bínnen toegestane tekst kan meeliften.
const SECRET_PATTERNS: RegExp[] = [
  /bearer\s+[a-z0-9\-._~+/]+=*/gi,
  /authorization\s*[:=]\s*\S+/gi,
  /(?:^|[\s;,])(?:set-)?cookie\s*[:=][^;\n]*/gi,
  /[?&](?:token|access_token|refresh_token|id_token|api[-_]?key|apikey|secret|auth|session|code)=[^&\s"']+/gi,
  // JWT's (drie base64url-delen met punten) — ook los van een "Bearer "-prefix.
  /\beyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{4,}\b/g,
];

const REDACTED = "[verwijderd]";

/** Verwijdert secret-achtige substrings uit vrije tekst. */
export function scrubSecrets(value: string): string {
  let out = value;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, REDACTED);
  }
  return out;
}

function cleanString(value: unknown, maxLength = MAX_FIELD_LENGTH): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const str = String(value).trim();
  if (!str) return undefined;
  return scrubSecrets(str.slice(0, maxLength));
}

function cleanClientError(value: unknown): ClientErrorEntry | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const raw = value as Record<string, unknown>;
  const message = cleanString(raw.message);
  if (!message) return undefined;
  const entry: ClientErrorEntry = { message };
  const source = cleanString(raw.source, 300);
  if (source) entry.source = source;
  const stack = cleanString(raw.stack, MAX_STACK_LENGTH);
  if (stack) entry.stack = stack;
  const at = cleanString(raw.at, 40);
  if (at) entry.at = at;
  return entry;
}

/**
 * Saneert onbetrouwbare input (client-payload) tot een veilige `ReportContext`.
 * - Alleen whitelisted sleutels; onbekende sleutels (token, cookie, headers,
 *   body, …) verdwijnen.
 * - Alle waarden worden string-gecoerced, getrimd, afgekapt en gescrubd.
 * - `clientErrors` gecapt op `MAX_CLIENT_ERRORS`, per entry gesaneerd.
 * - Faalt nooit: niet-object-input geeft een leeg object.
 */
export function sanitizeReportContext(raw: unknown): ReportContext {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const out: ReportContext = {};

  for (const key of REPORT_CONTEXT_KEYS) {
    if (key === "clientErrors") continue;
    const value = cleanString(source[key]);
    if (value) out[key] = value;
  }

  if (Array.isArray(source.clientErrors)) {
    const errors = source.clientErrors
      .slice(0, MAX_CLIENT_ERRORS)
      .map(cleanClientError)
      .filter((entry): entry is ClientErrorEntry => entry !== undefined);
    if (errors.length > 0) out.clientErrors = errors;
  }

  return out;
}

/** Kort, voorleesbaar referentienummer voor de melder, bv. "#K3F9A2C1". */
export function formatReportRef(id: string): string {
  return `#${id.slice(-8).toUpperCase()}`;
}
