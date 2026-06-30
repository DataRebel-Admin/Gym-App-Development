/**
 * Centrale registry voor de foutpagina-architectuur (premium error-UX).
 *
 * Eén bron van waarheid — net als `audit-actions`: nieuwe foutcode = één
 * `ERROR_PRESETS`-regel. Geen `server-only` import zodat zowel de server-pagina's
 * (`ErrorView`, `not-found`) als de client-componenten (`route-suggestions`) deze
 * kunnen lezen. Bevat geen DB- of header-toegang.
 */

export type ErrorCode = 401 | 403 | 404 | 500 | 503;

/** Visuele toon → bepaalt de illustratie-/accentstemming, niet de kleur zelf
 *  (kleur blijft de tenant-accent via de design-tokens). */
export type ErrorTone = "neutral" | "warning" | "danger";

export type ErrorPreset = {
  code: ErrorCode;
  /** Korte status-aanduiding onder het cijfer (badge). */
  kicker: string;
  title: string;
  description: string;
  tone: ErrorTone;
  /** Welke acties zinvol zijn voor deze fout. */
  actions: {
    /** "Probeer opnieuw" (alleen 5xx, vereist een reset-handler). */
    retry?: boolean;
    /** "Ga terug" (router.back). */
    back?: boolean;
    /** Toon route-suggesties/zoek (alleen 404). */
    suggestions?: boolean;
  };
};

export const ERROR_PRESETS: Record<ErrorCode, ErrorPreset> = {
  401: {
    code: 401,
    kicker: "Niet ingelogd",
    title: "Even inloggen",
    description:
      "Je bent niet (meer) ingelogd. Log opnieuw in om verder te gaan naar deze pagina.",
    tone: "neutral",
    actions: { back: true },
  },
  403: {
    code: 403,
    kicker: "Geen toegang",
    title: "Geen toegang",
    description:
      "Je hebt geen toegang tot deze pagina. Mogelijk hoort dit bij een andere rol of sportschool. Vraag je beheerder als je denkt dat dit niet klopt.",
    tone: "warning",
    actions: { back: true },
  },
  404: {
    code: 404,
    kicker: "Pagina niet gevonden",
    title: "Pagina niet gevonden",
    description:
      "De pagina die je probeert te openen bestaat niet, is verplaatst of je hebt mogelijk geen toegang tot deze pagina.",
    tone: "neutral",
    actions: { back: true, suggestions: true },
  },
  500: {
    code: 500,
    kicker: "Er ging iets mis",
    title: "Er ging iets mis",
    description:
      "Er is een onverwachte fout opgetreden aan onze kant. Probeer het zo opnieuw — gaat het daarna nog mis, dan kijken wij ernaar.",
    tone: "danger",
    actions: { retry: true, back: true },
  },
  503: {
    code: 503,
    kicker: "Tijdelijk offline",
    title: "Even geduld",
    description:
      "De dienst is tijdelijk niet beschikbaar, bijvoorbeeld door onderhoud. Probeer het over een paar minuten opnieuw.",
    tone: "warning",
    actions: { retry: true },
  },
};

export function getErrorPreset(code: ErrorCode): ErrorPreset {
  return ERROR_PRESETS[code];
}

/* -------------------------------------------------------------------------- */
/*  Navigatie-context (rol-bewust, tenant blijft behouden)                    */
/* -------------------------------------------------------------------------- */

export type DashRole = "SUPERADMIN" | "TENANT_ADMIN" | "TENANT_MEMBER";

/** Het juiste dashboard per rol (zie ook app/page.tsx). */
export function dashboardHref(role: DashRole | null | undefined): string {
  switch (role) {
    case "SUPERADMIN":
      return "/admin";
    case "TENANT_ADMIN":
      return "/owner";
    case "TENANT_MEMBER":
      return "/member";
    default:
      return "/";
  }
}

export function dashboardLabel(role: DashRole | null | undefined): string {
  return role === "SUPERADMIN" ? "Beheer-dashboard" : "Mijn dashboard";
}

/** Serialiseerbare navigatie-context die de server aan de client-layout geeft. */
export type ErrorNav = {
  isAuthed: boolean;
  role: DashRole | null;
  dashboardHref: string;
  dashboardLabel: string;
  homeHref: string;
  loginHref: string;
};

export function buildErrorNav(role: DashRole | null | undefined): ErrorNav {
  const authed = Boolean(role);
  return {
    isAuthed: authed,
    role: role ?? null,
    dashboardHref: dashboardHref(role),
    dashboardLabel: dashboardLabel(role),
    homeHref: "/",
    loginHref: "/login",
  };
}

/* -------------------------------------------------------------------------- */
/*  Bekende routes — voor typo-suggesties + zoek op de 404                     */
/* -------------------------------------------------------------------------- */

export type KnownRoute = {
  href: string;
  label: string;
  /** Voor wie deze route relevant is. "public" = altijd tonen. */
  audience: DashRole | "public";
};

/** Populaire/bekende bestemmingen per rol. Bewust handmatig (geen dynamische
 *  route-introspectie) zodat suggesties altijd zinvol en veilig zijn. */
export const KNOWN_ROUTES: KnownRoute[] = [
  // Publiek
  { href: "/", label: "Home", audience: "public" },
  { href: "/login", label: "Inloggen", audience: "public" },
  // Lid
  { href: "/member", label: "Mijn dashboard", audience: "TENANT_MEMBER" },
  { href: "/member/schema", label: "Mijn schema", audience: "TENANT_MEMBER" },
  { href: "/member/history", label: "Mijn voortgang", audience: "TENANT_MEMBER" },
  { href: "/member/rooster", label: "Rooster", audience: "TENANT_MEMBER" },
  { href: "/member/scan", label: "QR scannen", audience: "TENANT_MEMBER" },
  // Owner
  { href: "/owner", label: "Dashboard", audience: "TENANT_ADMIN" },
  { href: "/owner/members", label: "Leden", audience: "TENANT_ADMIN" },
  { href: "/owner/schemas", label: "Schema's", audience: "TENANT_ADMIN" },
  { href: "/owner/exercises", label: "Oefeningen", audience: "TENANT_ADMIN" },
  { href: "/owner/machines", label: "Apparatuur", audience: "TENANT_ADMIN" },
  { href: "/owner/rooster", label: "Rooster", audience: "TENANT_ADMIN" },
  { href: "/owner/insights", label: "Inzichten", audience: "TENANT_ADMIN" },
  { href: "/owner/audit", label: "Activiteit", audience: "TENANT_ADMIN" },
  { href: "/owner/settings", label: "Instellingen", audience: "TENANT_ADMIN" },
  // Superadmin
  { href: "/admin", label: "Platform-dashboard", audience: "SUPERADMIN" },
  { href: "/admin/tenants", label: "Sportscholen", audience: "SUPERADMIN" },
  { href: "/admin/users", label: "Gebruikers", audience: "SUPERADMIN" },
  { href: "/admin/audit", label: "Audit-log", audience: "SUPERADMIN" },
  // Account (alle ingelogde rollen)
  { href: "/account", label: "Account", audience: "public" },
];

/** Routes relevant voor een rol (publiek + de eigen rol). */
export function routesForRole(role: DashRole | null): KnownRoute[] {
  return KNOWN_ROUTES.filter(
    (r) => r.audience === "public" || r.audience === role
  );
}

/* -------------------------------------------------------------------------- */
/*  Fuzzy matching (typo-detectie) — pure helpers, ook client-side bruikbaar  */
/* -------------------------------------------------------------------------- */

/** Levenshtein-afstand tussen twee strings (iteratief, O(n·m)). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // verwijderen
        curr[j - 1] + 1, // invoegen
        prev[j - 1] + cost // vervangen
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

export type RouteSuggestion = {
  route: KnownRoute;
  distance: number;
  /** Genormaliseerde score 0–1 (1 = identiek). */
  score: number;
};

/**
 * Vind de meest gelijkende bekende route bij een (typo-)pad. Vergelijkt het
 * volledige genormaliseerde pad én het laatste segment, en neemt de beste.
 */
export function suggestRoutes(
  pathname: string,
  role: DashRole | null,
  limit = 4
): RouteSuggestion[] {
  const norm = (s: string) => s.toLowerCase().replace(/\/+$/, "") || "/";
  const target = norm(pathname);
  const targetTail = target.split("/").pop() ?? target;

  return routesForRole(role)
    .map((route) => {
      const cand = norm(route.href);
      const candTail = cand.split("/").pop() ?? cand;
      const distance = Math.min(
        levenshtein(target, cand),
        levenshtein(targetTail, candTail)
      );
      const longest = Math.max(target.length, cand.length, 1);
      const score = 1 - distance / longest;
      return { route, distance, score };
    })
    .filter((s) => s.route.href !== target)
    .sort((a, b) => a.distance - b.distance || b.score - a.score)
    .slice(0, limit);
}

/** Is de beste suggestie "zeer waarschijnlijk" (→ rechtvaardigt auto-redirect)? */
export function isHighConfidence(
  suggestion: RouteSuggestion | undefined,
  pathname: string
): boolean {
  if (!suggestion) return false;
  const tail = pathname.toLowerCase().replace(/\/+$/, "").split("/").pop() ?? "";
  // Alleen bij een echte (niet-triviale) typo: 1 teken verschil op een
  // voldoende lang segment. Voorkomt foute auto-navigatie bij korte paden.
  return suggestion.distance <= 1 && tail.length >= 4;
}
