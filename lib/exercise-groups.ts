// Groeperings-registry voor "slimme" schema's — de bron van waarheid voor
// supersets, giant/ultra sets, circuits en AMRAP + de dropset-helper.
//
// Bewust GEEN `server-only`: dit wordt zowel server-side (save-actions/validatie)
// als client-side (schema-editor, member-builder, actieve sessie, PDF-data) gebruikt
// — net als lib/exercise-types.ts en lib/errors.ts.
//
// Een "groep" is puur afgeleid: opeenvolgende WorkoutExerciseItems met dezelfde
// `groupId` horen bij elkaar. De groep-instellingen (type/rondes/rust-ná-groep/
// label/timecap) worden door de editor consistent op elk groepslid weggeschreven,
// zodat downstream-lezers ze van het eerste lid kunnen aflezen. Zie
// prisma/schema.prisma (WorkoutExerciseItem) en lib/schema-diff.ts.

import {
  Repeat,
  Layers,
  RotateCcw,
  Timer,
  type LucideIcon,
} from "@/components/ui/icons";

export type GroupTypeKey = "superset" | "giant" | "circuit" | "amrap";

export type GroupTypeDef = {
  key: GroupTypeKey;
  label: string;
  /** Kort label voor compacte badges ("SS", "Giant", "Circuit", "AMRAP"). */
  short: string;
  icon: LucideIcon;
  /** Tailwind tekst/achtergrond-tint (statisch, geen runtime kleur). */
  tone: string;
  description: string;
  /** Minimaal aantal oefeningen dat de groep zinvol maakt. */
  minItems: number;
  /** Heeft de groep een instelbaar aantal rondes? (circuit/AMRAP/superset). */
  hasRounds: boolean;
  /** Heeft de groep een tijdslimiet? (AMRAP). */
  hasTimeCap: boolean;
};

export const GROUP_TYPES: Record<GroupTypeKey, GroupTypeDef> = {
  superset: {
    key: "superset",
    label: "Superset",
    short: "SS",
    icon: Repeat,
    tone: "bg-violet-50 text-violet-600",
    description:
      "Twee oefeningen direct na elkaar zonder rust, dan pas rust. Klassiek voor tegengestelde spiergroepen.",
    minItems: 2,
    hasRounds: true,
    hasTimeCap: false,
  },
  giant: {
    key: "giant",
    label: "Giant set",
    short: "Giant",
    icon: Layers,
    tone: "bg-fuchsia-50 text-fuchsia-600",
    description:
      "Drie of meer oefeningen aaneengesloten zonder rust, een 'ultraset'. Hoge intensiteit.",
    minItems: 3,
    hasRounds: true,
    hasTimeCap: false,
  },
  circuit: {
    key: "circuit",
    label: "Circuit",
    short: "Circuit",
    icon: RotateCcw,
    tone: "bg-indigo-50 text-indigo-600",
    description:
      "Een reeks oefeningen die je een aantal rondes achter elkaar doorloopt, met rust ná elke ronde.",
    minItems: 2,
    hasRounds: true,
    hasTimeCap: false,
  },
  amrap: {
    key: "amrap",
    label: "AMRAP",
    short: "AMRAP",
    icon: Timer,
    tone: "bg-orange-50 text-orange-600",
    description:
      "As Many Rounds As Possible: zoveel mogelijk rondes binnen een tijdslimiet.",
    minItems: 2,
    hasRounds: false,
    hasTimeCap: true,
  },
};

export const GROUP_TYPE_KEYS = Object.keys(GROUP_TYPES) as GroupTypeKey[];

export function isGroupType(key: string | null | undefined): key is GroupTypeKey {
  return Boolean(key && key in GROUP_TYPES);
}

/** Veilige lookup; retourneert null bij onbekend/leeg (losstaand item). */
export function getGroupType(key: string | null | undefined): GroupTypeDef | null {
  return isGroupType(key) ? GROUP_TYPES[key] : null;
}

/** Opties voor een <select>/menu (value + label, in registry-volgorde). */
export function groupTypeOptions(): { value: GroupTypeKey; label: string }[] {
  return GROUP_TYPE_KEYS.map((k) => ({ value: k, label: GROUP_TYPES[k].label }));
}

// --- Groep-metadata op item-niveau ---------------------------------------

/** De groeperings-velden zoals ze op één item leven. */
export type GroupFields = {
  groupId: string | null;
  groupType: string | null;
  groupOrder: number;
  groupRounds: number | null;
  groupRestSeconds: number | null;
  groupLabel: string | null;
  groupTimeCapSeconds: number | null;
  dropsetCount: number | null;
};

/** Item-vorm die de groep-helpers nodig hebben (Prisma-rij of editor-item). */
export type GroupableItem = Partial<GroupFields> & Record<string, unknown>;

export const DEFAULT_GROUP_ROUNDS = 3;
export const DEFAULT_GROUP_REST_SECONDS = 90;
export const DEFAULT_AMRAP_SECONDS = 600; // 10 min
export const MAX_GROUP_ROUNDS = 50;

/** Snelle rust-presets (seconden) voor de editor-chips. */
export const REST_PRESETS_SECONDS = [30, 60, 90, 120, 180] as const;

/**
 * Normaliseer ruwe (client-)groep-/dropset-invoer naar veilige DB-kolommen.
 * Een groep telt alleen als er zowel een `groupId` als een geldig `groupType` is.
 * Grenzen worden server-side afgedwongen — de client wordt nooit vertrouwd.
 * Gedeeld door de owner- en member-save-actions.
 */
export function normalizeGroupColumns(it: Partial<GroupFields>): GroupFields {
  const validType = isGroupType(it.groupType) ? it.groupType : null;
  const grouped = Boolean(it.groupId && validType);
  return {
    groupId: grouped ? (it.groupId ?? "").trim() || null : null,
    groupType: grouped ? validType : null,
    groupOrder: grouped ? Math.max(0, Math.round(it.groupOrder ?? 0)) : 0,
    groupRounds: grouped ? clampRounds(it.groupRounds ?? null) : null,
    groupRestSeconds:
      grouped && it.groupRestSeconds != null
        ? Math.max(0, Math.min(3600, Math.round(it.groupRestSeconds)))
        : null,
    groupLabel: grouped ? (it.groupLabel ?? "").trim().slice(0, 60) || null : null,
    groupTimeCapSeconds:
      grouped && it.groupTimeCapSeconds != null
        ? Math.max(0, Math.min(36000, Math.round(it.groupTimeCapSeconds)))
        : null,
    dropsetCount: clampDropsetCount(it.dropsetCount ?? null),
  };
}

/** Kies de groep-/dropset-velden uit een item-rij (met veilige defaults). */
export function pickGroupFields(item: Partial<GroupFields>): GroupFields {
  return {
    groupId: item.groupId ?? null,
    groupType: item.groupType ?? null,
    groupOrder: item.groupOrder ?? 0,
    groupRounds: item.groupRounds ?? null,
    groupRestSeconds: item.groupRestSeconds ?? null,
    groupLabel: item.groupLabel ?? null,
    groupTimeCapSeconds: item.groupTimeCapSeconds ?? null,
    dropsetCount: item.dropsetCount ?? null,
  };
}

/** Sanitize/clamp een groeprondes-waarde. */
export function clampRounds(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.min(MAX_GROUP_ROUNDS, Math.max(1, Math.round(v)));
}

/** Sanitize/clamp een dropset-teller (0/negatief/onzin → null). */
export function clampDropsetCount(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  return n >= 1 ? Math.min(10, n) : null;
}

export function isDropset(item: GroupableItem): boolean {
  return (item.dropsetCount ?? 0) >= 1;
}

// --- Afgeleide groepering -------------------------------------------------

export type ItemGroup<T extends GroupableItem = GroupableItem> = {
  /** Groep-sleutel, of null voor een losstaand item. */
  groupId: string | null;
  type: GroupTypeDef | null;
  label: string | null;
  rounds: number | null;
  restSeconds: number | null;
  timeCapSeconds: number | null;
  items: T[];
};

/**
 * Groepeer een geordende itemlijst in opeenvolgende groepen. Items zonder
 * `groupId` (of met een uniek/eenzaam groupId) vormen een groep van één met
 * `type = null` (losstaand). Alleen ADJACENTE items met dezelfde groupId worden
 * samengevoegd — zo blijft de volgorde in het schema leidend en kan hetzelfde
 * groupId nooit per ongeluk twee losse blokken verbinden.
 */
export function groupItems<T extends GroupableItem>(items: T[]): ItemGroup<T>[] {
  const groups: ItemGroup<T>[] = [];
  for (const item of items) {
    const gid = item.groupId ?? null;
    const type = getGroupType(item.groupType);
    const prev = groups[groups.length - 1];
    if (gid && type && prev && prev.groupId === gid && prev.type) {
      prev.items.push(item);
      continue;
    }
    groups.push({
      groupId: gid && type ? gid : null,
      type: gid ? type : null,
      label: (item.groupLabel ?? null) || null,
      rounds: item.groupRounds ?? null,
      restSeconds: item.groupRestSeconds ?? null,
      timeCapSeconds: item.groupTimeCapSeconds ?? null,
      items: [item],
    });
  }
  return groups;
}

/** Is dit een echte (multi-item) groep? Eén losstaand item is dat niet. */
export function isRealGroup(group: ItemGroup): boolean {
  return group.type != null && group.items.length >= 2;
}

function durationLabel(seconds: number): string {
  const s = Math.round(seconds);
  if (s <= 0) return "0s";
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m === 0) return `${rest}s`;
  if (rest === 0) return `${m} min`;
  return `${m}m ${rest}s`;
}

/**
 * Korte, leesbare samenvatting van een groep-kop, bv.
 * "Superset · 3 rondes · rust 90s" of "AMRAP · 12 min".
 * Retourneert null voor losstaande items.
 */
export function groupSummary(group: ItemGroup): string | null {
  if (!group.type) return null;
  const parts: string[] = [group.label?.trim() || group.type.label];
  if (group.type.hasTimeCap && group.timeCapSeconds) {
    parts.push(durationLabel(group.timeCapSeconds));
  } else if (group.type.hasRounds) {
    const rounds = clampRounds(group.rounds) ?? DEFAULT_GROUP_ROUNDS;
    parts.push(`${rounds} rondes`);
  }
  if (group.restSeconds != null) {
    parts.push(`rust ${durationLabel(group.restSeconds)}`);
  }
  return parts.join(" · ");
}

/** A/B/C-letter voor de positie binnen een groep (0 → "A"). */
export function groupPositionLabel(index: number): string {
  if (index < 0) return "";
  if (index < 26) return String.fromCharCode(65 + index);
  return `${index + 1}`;
}
