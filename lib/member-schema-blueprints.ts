// Ingebouwde start-blueprints voor zelf-gebouwde lid-schema's: lege dag-structuren
// die het lid als vertrekpunt kiest ("Push/Pull/Legs", "Full body", …). Géén
// `server-only` — ook client-bruikbaar (bron-keuze in de builder). Naast deze
// blueprints kan een lid ook starten vanuit een door de owner vrijgegeven
// library-template (WorkoutTemplate.memberVisible) of vanaf leeg.
//
// Nieuw blueprint = één record hieronder. Dagen zijn bewust zónder oefeningen:
// het lid vult ze zelf, binnen de eventuele kaders (lib/member-schema-constraints).

import {
  Dumbbell,
  Activity,
  Heart,
  Flame,
  RotateCcw,
  HeartPulse,
  type LucideIcon,
} from "@/components/ui/icons";

export type SchemaBlueprint = {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Lege dag-namen (structuur), zonder oefeningen. */
  days: string[];
  /** Trainingsdoelen (keys uit lib/training-goals.ts) waar dit blueprint bij
   *  past — voedt de "past bij jouw doel"-sortering in de builder. Leeg =
   *  matcht nooit (bewust zo bij "leeg starten"). */
  goals: string[];
};

export const SCHEMA_BLUEPRINTS: SchemaBlueprint[] = [
  {
    key: "fullbody",
    label: "Full body",
    description: "Één training voor het hele lichaam, ideaal 2–3× per week.",
    icon: Dumbbell,
    days: ["Full body A", "Full body B", "Full body C"],
    goals: ["muscle", "strength", "health"],
  },
  {
    key: "upperlower",
    label: "Upper / Lower",
    description: "Bovenlichaam en onderlichaam op aparte dagen.",
    icon: Dumbbell,
    days: ["Upper", "Lower"],
    goals: ["muscle", "strength"],
  },
  {
    key: "ppl",
    label: "Push / Pull / Legs",
    description: "Duwen, trekken en benen: de klassieke driedeling.",
    icon: Dumbbell,
    days: ["Push", "Pull", "Legs"],
    goals: ["muscle"],
  },
  {
    key: "cardio",
    label: "Cardio",
    description: "Conditie-opbouw met cardiotraining.",
    icon: Heart,
    days: ["Cardio 1", "Cardio 2"],
    goals: ["conditioning", "fat_loss"],
  },
  {
    key: "strength",
    label: "Kracht",
    description: "Puur op krachtopbouw gerichte split.",
    icon: Flame,
    days: ["Kracht 1", "Kracht 2", "Kracht 3"],
    goals: ["strength", "sport"],
  },
  {
    key: "condition",
    label: "Conditie",
    description: "Gemengde conditie- en circuittraining.",
    icon: Activity,
    days: ["Conditie 1", "Conditie 2"],
    goals: ["conditioning", "fat_loss", "health", "sport"],
  },
  {
    key: "recovery",
    label: "Herstel",
    description: "Rustige herstel-, mobiliteits- en stretchdag.",
    icon: HeartPulse,
    days: ["Herstel"],
    goals: ["rehab", "mobility", "stability"],
  },
  {
    key: "scratch",
    label: "Leeg starten",
    description: "Begin met één lege dag en bouw helemaal zelf op.",
    icon: RotateCcw,
    days: ["Dag 1"],
    goals: [],
  },
];

export function getBlueprint(key: string): SchemaBlueprint | undefined {
  return SCHEMA_BLUEPRINTS.find((b) => b.key === key);
}
