// Schema-badge-registry — vrij toewijsbare, visuele labels voor een
// trainingsschema (⭐ Beginner, 💪 Kracht, 🔥 Spieropbouw, ⚡ Intensief, …). Bron
// van waarheid voor label, icoon en kleur; idiomatisch zoals lib/training-goals.ts.
//
// Verschil met `goal` (WorkoutTemplate.goal): `goal` is het ÉNE neutrale
// trainingsdoel voor personalisatie/matching; badges zijn MEERDERE vrije labels
// puur voor herkenbaarheid in lijsten en op het dashboard.
//
// Bewust GEEN `server-only`: gebruikt in de schema-editor (client) én bij het
// tonen (server + client). Nieuwe badge = één record hieronder ("eigen badges
// toevoegen" is hiermee voorbereid) — géén DB-migratie nodig (String[]-kolom).

import {
  Star,
  Dumbbell,
  Flame,
  Activity,
  Heart,
  Zap,
  PersonStanding,
  Weight,
  HeartPulse,
  type LucideIcon,
} from "@/components/ui/icons";

export type SchemaBadgeDef = {
  key: string;
  /** Korte label (NL-bron, zoals training-goals/GoalBadge). */
  label: string;
  icon: LucideIcon;
  /** Statische Tailwind tint (geen runtime kleur). */
  tone: string;
};

export const SCHEMA_BADGES: Record<string, SchemaBadgeDef> = {
  beginner: { key: "beginner", label: "Beginner", icon: Star, tone: "bg-amber-50 text-amber-600" },
  strength: { key: "strength", label: "Kracht", icon: Dumbbell, tone: "bg-accent-soft text-accent" },
  muscle: { key: "muscle", label: "Spieropbouw", icon: Flame, tone: "bg-orange-50 text-orange-600" },
  conditioning: { key: "conditioning", label: "Conditie", icon: Activity, tone: "bg-sky-50 text-sky-600" },
  fat_loss: { key: "fat_loss", label: "Afvallen", icon: Heart, tone: "bg-rose-50 text-rose-600" },
  intense: { key: "intense", label: "Intensief", icon: Zap, tone: "bg-yellow-50 text-yellow-700" },
  mobility: { key: "mobility", label: "Mobiliteit", icon: PersonStanding, tone: "bg-teal-50 text-teal-600" },
  hypertrophy: { key: "hypertrophy", label: "Hypertrofie", icon: Weight, tone: "bg-violet-50 text-violet-600" },
  rehab: { key: "rehab", label: "Revalidatie", icon: HeartPulse, tone: "bg-emerald-50 text-emerald-600" },
};

export const SCHEMA_BADGE_KEYS = Object.keys(SCHEMA_BADGES) as [string, ...string[]];

export function getSchemaBadge(key: string | null | undefined): SchemaBadgeDef | null {
  return (key && SCHEMA_BADGES[key]) || null;
}

export function isSchemaBadge(key: string | null | undefined): key is string {
  return Boolean(key && key in SCHEMA_BADGES);
}

/** Opties voor een multi-select chip-lijst (registry-volgorde). */
export function schemaBadgeOptions(): SchemaBadgeDef[] {
  return SCHEMA_BADGE_KEYS.map((k) => SCHEMA_BADGES[k]);
}

/** Parse een (Json/onbekende) waarde naar een gevalideerde, ontdubbelde key-lijst. */
export function parseBadges(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const v of value) {
    if (typeof v === "string" && v in SCHEMA_BADGES) seen.add(v);
  }
  return [...seen];
}
