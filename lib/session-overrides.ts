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

/** Genormaliseerde vorm van `WorkoutSession.overrides`. */
export type SessionOverrides = {
  /** Exercise.id's die het lid in deze sessie heeft overgeslagen. */
  skipped: string[];
  /** Vervangingen (origineel-id → alternatief) in deze sessie. */
  subs: SessionSub[];
};

const EMPTY: SessionOverrides = { skipped: [], subs: [] };

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
  return { skipped: [...new Set(skipped)], subs };
}

/** Serialiseer terug naar een Prisma-JSON-object (voor de `overrides`-kolom). */
export function toOverridesJson(o: SessionOverrides): Prisma.InputJsonObject {
  return { skipped: [...new Set(o.skipped)], subs: o.subs } as Prisma.InputJsonObject;
}

// Alle helpers keyen op de **oorspronkelijke** template-oefening (`from`), zodat
// overslaan en vervangen elkaar niet in de weg zitten (ook na een swap → skip):
// een template-item is óf normaal, óf vervangen, óf overgeslagen.

/** Markeer een oefening als overgeslagen (idempotent; heft een evt. sub op). */
export function withSkipped(value: unknown, originalId: string): SessionOverrides {
  const cur = parseOverrides(value);
  return {
    skipped: [...new Set([...cur.skipped, originalId])],
    subs: cur.subs.filter((s) => s.from !== originalId),
  };
}

/** Verwijder de skip-markering van een oefening (undo). */
export function withoutSkipped(value: unknown, originalId: string): SessionOverrides {
  const cur = parseOverrides(value);
  return { skipped: cur.skipped.filter((id) => id !== originalId), subs: cur.subs };
}

/**
 * Registreer een vervanging origineel → alternatief. `from` (het template-item)
 * blijft uniek; een eerdere vervanging/skip van hetzelfde item wordt vervangen.
 */
export function withSub(value: unknown, sub: SessionSub): SessionOverrides {
  const cur = parseOverrides(value);
  return {
    skipped: cur.skipped.filter((id) => id !== sub.from),
    subs: [...cur.subs.filter((s) => s.from !== sub.from), sub],
  };
}
