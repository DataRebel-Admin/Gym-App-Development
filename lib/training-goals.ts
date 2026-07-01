// Trainingsdoel-registry — één neutrale woordenschat voor trainingsdoelen,
// gedeeld door zowel de template-tag (WorkoutTemplate.goal) als de door de
// sporter zélf gekozen doelen (User.trainingGoals). Zo kan de app templates ↔
// sporterdoelen matchen voor personalisatie.
//
// Bewust GEEN `server-only`: gebruikt in server-actions/seed én in client-UI
// (doelkiezer, badges) — net als lib/exercise-types.ts, lib/rbac.ts.
//
// Ontwerpprincipe (inclusiviteit): de lijst dekt uiteenlopende doelen zodat de
// app niet neigt naar één doelgroep (bv. bodybuilding). Geen enkel doel is
// "standaard" of geprivilegieerd. Nieuw doel = één record hieronder.

import {
  Dumbbell,
  Flame,
  TrendingDown,
  Heart,
  Activity,
  Scale,
  HeartPulse,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "@/components/ui/icons";

export type TrainingGoalDef = {
  key: string;
  /** Neutrale, motiverende naam (owner-tag + sporterkeuze delen deze). */
  label: string;
  /** Korte, sporter-gerichte omschrijving ("ik-vorm"). */
  description: string;
  icon: LucideIcon;
  /** Statische Tailwind tint voor het chip (geen runtime kleur). */
  tone: string;
  /** Oefeningstypes die dit doel doorgaans benadrukt — voedt template-matching
   *  en suggesties. Verwijst naar keys uit lib/exercise-types.ts. */
  emphasizes: string[];
};

export const TRAINING_GOALS: Record<string, TrainingGoalDef> = {
  strength: {
    key: "strength",
    label: "Sterker worden",
    description: "Meer kracht opbouwen in samengestelde oefeningen.",
    icon: Dumbbell,
    tone: "bg-accent-soft text-accent",
    emphasizes: ["strength", "functional"],
  },
  muscle: {
    key: "muscle",
    label: "Spieropbouw",
    description: "Spiermassa opbouwen met gerichte training.",
    icon: Flame,
    tone: "bg-orange-50 text-orange-600",
    emphasizes: ["strength"],
  },
  fat_loss: {
    key: "fat_loss",
    label: "Afvallen",
    description: "Vet verliezen met een mix van kracht en cardio.",
    icon: TrendingDown,
    tone: "bg-rose-50 text-rose-600",
    emphasizes: ["cardio", "hiit", "circuit", "strength"],
  },
  conditioning: {
    key: "conditioning",
    label: "Conditie verbeteren",
    description: "Uithoudingsvermogen en hart- en longfunctie versterken.",
    icon: Heart,
    tone: "bg-sky-50 text-sky-600",
    emphasizes: ["cardio", "endurance", "hiit"],
  },
  mobility: {
    key: "mobility",
    label: "Mobiliteit",
    description: "Soepeler en met meer bewegingsvrijheid bewegen.",
    icon: Activity,
    tone: "bg-teal-50 text-teal-600",
    emphasizes: ["mobility", "stretch"],
  },
  stability: {
    key: "stability",
    label: "Stabiliteit & balans",
    description: "Meer controle en balans in je bewegingen.",
    icon: Scale,
    tone: "bg-emerald-50 text-emerald-600",
    emphasizes: ["stability", "core"],
  },
  rehab: {
    key: "rehab",
    label: "Blessurevrij bewegen",
    description: "Herstellen en blessures voorkomen met rustige, gerichte oefeningen.",
    icon: HeartPulse,
    tone: "bg-pink-50 text-pink-600",
    emphasizes: ["rehab", "mobility", "stability"],
  },
  health: {
    key: "health",
    label: "Gezond & energiek",
    description: "Fit blijven, meer energie en een gezonde leefstijl.",
    icon: Sparkles,
    tone: "bg-violet-50 text-violet-600",
    emphasizes: ["cardio", "strength", "mobility"],
  },
  sport: {
    key: "sport",
    label: "Sportspecifiek",
    description: "Trainen voor de eisen van je sport.",
    icon: Trophy,
    tone: "bg-indigo-50 text-indigo-600",
    emphasizes: ["functional", "strength", "hiit"],
  },
};

export const TRAINING_GOAL_KEYS = Object.keys(TRAINING_GOALS) as [string, ...string[]];

/** Veilige lookup — retourneert null bij een onbekende/lege key. */
export function getTrainingGoal(key: string | null | undefined): TrainingGoalDef | null {
  return (key && TRAINING_GOALS[key]) || null;
}

export function trainingGoalLabel(key: string | null | undefined): string {
  return getTrainingGoal(key)?.label ?? "";
}

/** Opties voor een <select>/checkbox-lijst (value + label, in registry-volgorde). */
export function trainingGoalOptions(): { value: string; label: string }[] {
  return Object.values(TRAINING_GOALS).map((g) => ({ value: g.key, label: g.label }));
}

export function isTrainingGoal(key: string | null | undefined): key is string {
  return Boolean(key && key in TRAINING_GOALS);
}

/** Parse een (Json) waarde uit User.trainingGoals naar een gevalideerde key-lijst. */
export function parseTrainingGoals(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v in TRAINING_GOALS);
}
