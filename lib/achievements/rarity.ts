// Zeldzaamheidsniveaus voor trofeeën/achievements — één bron van waarheid voor de
// premium badge-uitstraling. Bewust GEEN `server-only`: gebruikt in server- én
// client-componenten (badges), net als lib/exercise-types.ts / lib/training-goals.ts.

export type Rarity =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "legendary";

export type RarityMeta = {
  key: Rarity;
  /** Volwassen, sportieve NL-naam (geen kinderachtige termen). */
  label: string;
  /** Rangorde (0 = laagst) — bepaalt "mooiste achievement" + sortering. */
  order: number;
  /** Gradient voor de medaille/badge (Tailwind, statisch — geen runtime kleur). */
  gradient: string;
  /** Tekstkleur die leesbaar is op de gradient. */
  onGradient: string;
  /** Zachte chip-styling (label-pill). */
  chip: string;
  /** Ring-/accentkleur (hex) voor de voortgangsring per rariteit. */
  ring: string;
  /** Subtiele gloed achter de badge. */
  glow: string;
};

export const RARITY_META: Record<Rarity, RarityMeta> = {
  bronze: {
    key: "bronze",
    label: "Brons",
    order: 0,
    gradient: "bg-gradient-to-br from-amber-700 via-amber-500 to-amber-600",
    onGradient: "text-amber-50",
    chip: "bg-amber-100 text-amber-800",
    ring: "#b45309",
    glow: "bg-amber-500/25",
  },
  silver: {
    key: "silver",
    label: "Zilver",
    order: 1,
    gradient: "bg-gradient-to-br from-slate-400 via-slate-200 to-slate-400",
    onGradient: "text-slate-800",
    chip: "bg-slate-200 text-slate-700",
    ring: "#64748b",
    glow: "bg-slate-400/25",
  },
  gold: {
    key: "gold",
    label: "Goud",
    order: 2,
    gradient: "bg-gradient-to-br from-yellow-500 via-amber-300 to-yellow-500",
    onGradient: "text-yellow-900",
    chip: "bg-yellow-100 text-yellow-800",
    ring: "#eab308",
    glow: "bg-yellow-400/30",
  },
  platinum: {
    key: "platinum",
    label: "Platinum",
    order: 3,
    gradient: "bg-gradient-to-br from-cyan-200 via-slate-100 to-cyan-300",
    onGradient: "text-slate-800",
    chip: "bg-cyan-100 text-cyan-800",
    ring: "#0891b2",
    glow: "bg-cyan-300/30",
  },
  diamond: {
    key: "diamond",
    label: "Diamant",
    order: 4,
    gradient: "bg-gradient-to-br from-sky-400 via-cyan-200 to-sky-400",
    onGradient: "text-sky-900",
    chip: "bg-sky-100 text-sky-800",
    ring: "#0ea5e9",
    glow: "bg-sky-400/30",
  },
  legendary: {
    key: "legendary",
    label: "Legendarisch",
    order: 5,
    gradient: "bg-gradient-to-br from-fuchsia-500 via-purple-500 to-amber-400",
    onGradient: "text-white",
    chip: "bg-fuchsia-100 text-fuchsia-800",
    ring: "#a855f7",
    glow: "bg-fuchsia-500/30",
  },
};

export function rarityMeta(rarity: string): RarityMeta {
  return RARITY_META[rarity as Rarity] ?? RARITY_META.bronze;
}

/** Rangorde van een rariteit (voor "mooiste achievement" / sortering). */
export function rarityOrder(rarity: string): number {
  return rarityMeta(rarity).order;
}

export const RARITIES = Object.values(RARITY_META).sort((a, b) => a.order - b.order);
