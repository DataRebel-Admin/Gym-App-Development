/**
 * Centrale, uitbreidbare registry van feature flags (modules die de Superadmin
 * per tenant aan/uit kan zetten). Eén bron van waarheid voor zowel de frontend
 * als de backend — geen hardgecodeerde aan/uit-controles verspreid door de code.
 *
 * Géén `server-only`: deze registry (labels/omschrijvingen/defaults) wordt óók
 * client-side gebruikt (beheer-UI, nav-filtering). Idiomatisch zoals
 * `lib/exercise-types.ts` en `lib/audit-actions.ts`.
 *
 * Nieuwe feature = één record hieronder toevoegen + de flag controleren op de
 * relevante plekken (`isFeatureEnabled`). Géén DB-migratie nodig: de sleutels
 * zijn vrije strings in het `FeatureFlag`-model.
 */

export type FeatureKey = "maintenance" | "group_classes" | "ai";

export type FeatureDef = {
  key: FeatureKey;
  /** Weergavenaam in de beheer-UI. */
  name: string;
  /** Korte omschrijving van wat de module doet. */
  description: string;
  /** Emoji/icoon voor de kaart. */
  icon: string;
  /**
   * Standaardwaarde als er (nog) geen `FeatureFlag`-rij voor de tenant bestaat.
   * Gekozen om bestaand gedrag te behouden: modules die vandaag altijd aan staan
   * hebben `true`. Voor AI is de module beschikbaar (true); de owner-`aiEnabled`
   * blijft de fijnmazige sub-toggle binnen de gym.
   */
  defaultEnabled: boolean;
};

export const FEATURES: Record<FeatureKey, FeatureDef> = {
  maintenance: {
    key: "maintenance",
    name: "Gym Onderhoud",
    description:
      "Onderhoudsbeheer voor fitnessapparatuur: signalering op gebruik en tijd, dashboard, historie en meldingen.",
    icon: "🔧",
    defaultEnabled: true,
  },
  group_classes: {
    key: "group_classes",
    name: "Groepslessen boeken",
    description:
      "Leden reserveren groepslessen en zien de agenda; de sportschool beheert het rooster. Bestaande boekingen blijven bewaard.",
    icon: "📅",
    defaultEnabled: true,
  },
  ai: {
    key: "ai",
    name: "AI-functionaliteit",
    description:
      "AI Coach & Assistant: chat, suggesties, oefening-uitleg en coach-analyses. Masterschakelaar boven de eigen AI-instelling van de sportschool.",
    icon: "🤖",
    defaultEnabled: true,
  },
};

/** Alle feature-sleutels in weergavevolgorde. */
export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];

/** Type-guard: is dit een bekende feature-sleutel? */
export function isFeatureKey(key: string): key is FeatureKey {
  return key in FEATURES;
}

/** Definitie voor een feature (throwt niet: onbekende sleutel → undefined). */
export function getFeatureDef(key: string): FeatureDef | undefined {
  return isFeatureKey(key) ? FEATURES[key] : undefined;
}

/** Volledige set met code-defaults (basis waarop DB-overrides worden gelegd). */
export function defaultFeatureFlags(): Record<FeatureKey, boolean> {
  const out = {} as Record<FeatureKey, boolean>;
  for (const key of FEATURE_KEYS) out[key] = FEATURES[key].defaultEnabled;
  return out;
}
