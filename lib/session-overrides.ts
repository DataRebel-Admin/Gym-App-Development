// Pure helpers voor `WorkoutSession.overrides` (Json-kolom): sessie-scoped
// aanpassingen die het template NIET muteren — overgeslagen oefeningen en
// gekozen alternatieven. Bewust GEEN `server-only`: gebruikt in server-actions
// (schrijven) én kan client-side gelezen worden (net als lib/exercise-types.ts,
// lib/user-preferences.ts). Puur, geen DB-toegang.

import type { Prisma } from "@prisma/client";

/** Eén sessie-scoped vervanging: origineel → gekozen alternatief. */
export type SessionSub = {
  /** Exercise.id van de oorspronkelijke (vervangen) oefening. */
  from: string;
  /** Exercise.id van het gekozen alternatief. */
  to: string;
  /** Naam van het alternatief (gedenormaliseerd voor historie/weergave). */
  name: string;
};

/**
 * Harde bovengrens voor het aantal sets van één oefening in een sessie —
 * gelijk aan de grens van de log-laag (`setInputSchema`: setNumber ≤ 20).
 */
export const MAX_SESSION_SETS = 20;

/** Genormaliseerde vorm van `WorkoutSession.overrides`. */
export type SessionOverrides = {
  /** Exercise.id's die het lid in deze sessie heeft overgeslagen. */
  skipped: string[];
  /** Vervangingen (origineel-id → alternatief) in deze sessie. */
  subs: SessionSub[];
  /**
   * Sessie-scoped set-aantal per **gerenderde** oefening (dus ná een evt.
   * vervanging — net als waar de log-entries op hangen): het lid heeft hier
   * sets toegevoegd of verwijderd. Overschrijft het schema-aantal, zodat een
   * lege extra set niet verdwijnt zodra de pagina opnieuw laadt.
   */
  setCounts: Record<string, number>;
};

const EMPTY: SessionOverrides = { skipped: [], subs: [], setCounts: {} };

/**
 * Klem een gewenst set-aantal op 1..MAX_SESSION_SETS (of `null` bij onzin).
 * Alleen echte getallen (of een numerieke string) tellen: `null`/`""`/`[]`
 * zouden via `Number()` stil 0 worden en dus als "1 set" doorgaan.
 */
function normalizeCount(value: unknown): number | null {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(raw)) return null;
  return Math.min(MAX_SESSION_SETS, Math.max(1, Math.floor(raw)));
}

/** Ruwe Json → een veilig, volledig `SessionOverrides`-object (nooit null/array). */
export function parseOverrides(value: unknown): SessionOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...EMPTY };
  const raw = value as Record<string, unknown>;
  const skipped = Array.isArray(raw.skipped)
    ? raw.skipped.filter((x): x is string => typeof x === "string")
    : [];
  const subs = Array.isArray(raw.subs)
    ? raw.subs
        .filter(
          (s): s is SessionSub =>
            !!s &&
            typeof s === "object" &&
            typeof (s as SessionSub).from === "string" &&
            typeof (s as SessionSub).to === "string"
        )
        .map((s) => ({ from: s.from, to: s.to, name: typeof s.name === "string" ? s.name : "" }))
    : [];
  const setCounts: Record<string, number> = {};
  if (raw.setCounts && typeof raw.setCounts === "object" && !Array.isArray(raw.setCounts)) {
    for (const [id, value] of Object.entries(raw.setCounts as Record<string, unknown>)) {
      const count = normalizeCount(value);
      if (count !== null) setCounts[id] = count;
    }
  }
  return { skipped: [...new Set(skipped)], subs, setCounts };
}

/** Serialiseer terug naar een Prisma-JSON-object (voor de `overrides`-kolom). */
export function toOverridesJson(o: SessionOverrides): Prisma.InputJsonObject {
  return {
    skipped: [...new Set(o.skipped)],
    subs: o.subs,
    setCounts: o.setCounts,
  } as Prisma.InputJsonObject;
}

// Alle helpers keyen op de **oorspronkelijke** template-oefening (`from`), zodat
// overslaan en vervangen elkaar niet in de weg zitten (ook na een swap → skip):
// een template-item is óf normaal, óf vervangen, óf overgeslagen.

/** Markeer een oefening als overgeslagen (idempotent; heft een evt. sub op). */
export function withSkipped(value: unknown, originalId: string): SessionOverrides {
  const cur = parseOverrides(value);
  return {
    ...cur,
    skipped: [...new Set([...cur.skipped, originalId])],
    subs: cur.subs.filter((s) => s.from !== originalId),
  };
}

/** Verwijder de skip-markering van een oefening (undo). */
export function withoutSkipped(value: unknown, originalId: string): SessionOverrides {
  const cur = parseOverrides(value);
  return { ...cur, skipped: cur.skipped.filter((id) => id !== originalId) };
}

/**
 * Registreer een vervanging origineel → alternatief. `from` (het template-item)
 * blijft uniek; een eerdere vervanging/skip van hetzelfde item wordt vervangen.
 */
export function withSub(value: unknown, sub: SessionSub): SessionOverrides {
  const cur = parseOverrides(value);
  return {
    ...cur,
    skipped: cur.skipped.filter((id) => id !== sub.from),
    subs: [...cur.subs.filter((s) => s.from !== sub.from), sub],
  };
}

/**
 * Draai een vervanging terug: het template-item wordt weer met de
 * oorspronkelijke oefening getoond. Het set-aantal van het alternatief blijft
 * bewust staan — kiest het lid hetzelfde alternatief opnieuw, dan krijgt het
 * z'n eigen sets terug.
 */
export function withoutSub(value: unknown, originalId: string): SessionOverrides {
  const cur = parseOverrides(value);
  return { ...cur, subs: cur.subs.filter((s) => s.from !== originalId) };
}

/**
 * Leg het gewenste aantal sets van één (gerenderde) oefening vast. `count`
 * wordt geklemd op 1..MAX_SESSION_SETS; onzin laat de overrides ongemoeid.
 */
export function withSetCount(
  value: unknown,
  exerciseId: string,
  count: number
): SessionOverrides {
  const cur = parseOverrides(value);
  const normalized = normalizeCount(count);
  if (normalized === null) return cur;
  return { ...cur, setCounts: { ...cur.setCounts, [exerciseId]: normalized } };
}
