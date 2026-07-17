/**
 * Pure 3-weg-diff-engine voor trainingsschema's (géén `server-only` — bruikbaar
 * in server- én client-componenten).
 *
 * Achtergrond: een aan een lid toegewezen schema is een gematerialiseerde kopie
 * van een master-library-template. `AssignedWorkout.baselineSnapshot` legt de
 * master-staat vast op koppel-/sync-moment. Daarmee:
 *   - persoonlijke aanpassingen = diff(baseline → persoonlijke kopie)
 *   - master-wijzigingen sinds sync = diff(baseline → huidige master)
 *   - vergelijkingsscherm = diff(master → persoonlijke kopie)
 *
 * De engine werkt op genormaliseerde snapshots (geen Prisma-typen) en levert een
 * platte lijst diff-entries met stabiele id's, zodat de UI ze kan groeperen en
 * server-actions één specifieke wijziging gericht kunnen toepassen.
 */

/** Type-specifieke doelparameters (cardio/HIIT/…) die niet in een vaste kolom
 *  passen — opgeslagen in WorkoutExerciseItem.params (JSON). Zie lib/exercise-params. */
export type ParamBag = Record<string, string | number> | null;

export type ItemSnapshot = {
  exerciseId: string;
  sets: number;
  reps: number;
  restSeconds: number;
  weightKg: number | null;
  tempo: string | null;
  params: ParamBag;
  notes: string | null;
  // --- Groeperen (superset/giant/circuit/AMRAP) + dropset ---
  // Coach-eigendom → wél meegesynct vanuit de master (bundel-veld "group"/"dropset").
  // `memberNote` staat bewust NIET in de snapshot: die is per-lid/persoonlijk en
  // wordt nooit gesynct of als personalisatie gedetecteerd.
  groupId: string | null;
  groupType: string | null;
  groupOrder: number;
  groupRounds: number | null;
  groupRestSeconds: number | null;
  groupLabel: string | null;
  groupTimeCapSeconds: number | null;
  dropsetCount: number | null;
};

export type DaySnapshot = {
  name: string;
  notes: string | null;
  items: ItemSnapshot[];
};

export type SchemaSnapshot = {
  coachNote: string | null;
  days: DaySnapshot[];
};

/** Velden die per oefening kunnen wijzigen (waarde-overrides). `params` dekt alle
 *  type-specifieke doelvelden (tijd/afstand/zone/…) als één geheel; `group` dekt
 *  alle groeperings-instellingen (type/rondes/rust-ná-groep/label/timecap) als
 *  één geheel; `dropset` is het dropset-aantal. */
export type ItemField =
  | "sets"
  | "reps"
  | "weightKg"
  | "restSeconds"
  | "tempo"
  | "params"
  | "notes"
  | "group"
  | "dropset";
export const ITEM_FIELDS: ItemField[] = [
  "sets",
  "reps",
  "weightKg",
  "restSeconds",
  "tempo",
  "params",
  "notes",
  "group",
  "dropset",
];

export type DiffEntry = {
  /** Stabiele id: `${dayIndex}:${kind}:${exerciseId}#${occurrence}`. */
  id: string;
  dayIndex: number;
  dayName: string;
  kind: "changed" | "added" | "removed" | "replaced";
  /** Doel-oefening (bij replaced/added: de nieuwe; bij removed: de verwijderde). */
  exerciseId: string;
  /** Alleen bij "replaced": de oorspronkelijke oefening. */
  fromExerciseId?: string;
  before?: ItemSnapshot;
  after?: ItemSnapshot;
  /** Alleen bij "changed": welke velden verschillen. */
  fields?: ItemField[];
};

export type DayDiff = {
  dayIndex: number;
  name: string;
  status: "added" | "removed" | "present";
  notesChanged: boolean;
  entries: DiffEntry[];
};

export type SchemaDiff = {
  coachNoteChanged: boolean;
  days: DayDiff[];
  /** Platte lijst van alle item-entries (handig voor tellingen + gericht toepassen). */
  entries: DiffEntry[];
};

// --- Normalisatie -----------------------------------------------------------

function emptyToNull(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

/** Normaliseer een JSON-params-waarde naar een vlakke {key: string|number} of null. */
function normParams(v: unknown): ParamBag {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, string | number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "number" || typeof val === "string") out[k] = val;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Stabiele (sleutel-gesorteerde) stringify voor params-vergelijking. */
function stableParams(p: ParamBag): string {
  if (!p) return "";
  return JSON.stringify(
    Object.keys(p)
      .sort()
      .map((k) => [k, p[k]])
  );
}

/** Groep-bundel als één vergelijkbare string (voor het logische veld "group"). */
function stableGroup(it: ItemSnapshot): string {
  if (!it.groupId || !it.groupType) return ""; // losstaand item
  return JSON.stringify([
    it.groupId,
    it.groupType,
    it.groupOrder,
    it.groupRounds ?? null,
    it.groupRestSeconds ?? null,
    (it.groupLabel ?? "").trim(),
    it.groupTimeCapSeconds ?? null,
  ]);
}

/** Item-vorm met optionele groep-velden voor de normalisatie. */
type RawGroupFields = {
  groupId?: string | null;
  groupType?: string | null;
  groupOrder?: number | null;
  groupRounds?: number | null;
  groupRestSeconds?: number | null;
  groupLabel?: string | null;
  groupTimeCapSeconds?: number | null;
  dropsetCount?: number | null;
};

/** De groep/dropset-subset van een ItemSnapshot. */
type GroupSnapshotFields = Pick<
  ItemSnapshot,
  | "groupId"
  | "groupType"
  | "groupOrder"
  | "groupRounds"
  | "groupRestSeconds"
  | "groupLabel"
  | "groupTimeCapSeconds"
  | "dropsetCount"
>;

function normGroup(it: RawGroupFields): GroupSnapshotFields {
  const gid = it.groupId ?? null;
  const gtype = emptyToNull(it.groupType ?? null);
  const grouped = Boolean(gid && gtype);
  return {
    groupId: grouped ? gid : null,
    groupType: grouped ? gtype : null,
    groupOrder: grouped ? Number(it.groupOrder ?? 0) : 0,
    groupRounds: it.groupRounds == null ? null : Number(it.groupRounds),
    groupRestSeconds: it.groupRestSeconds == null ? null : Number(it.groupRestSeconds),
    groupLabel: emptyToNull(it.groupLabel ?? null),
    groupTimeCapSeconds: it.groupTimeCapSeconds == null ? null : Number(it.groupTimeCapSeconds),
    dropsetCount:
      it.dropsetCount == null || Number(it.dropsetCount) < 1 ? null : Number(it.dropsetCount),
  };
}

/** Genormaliseerde snapshot van een template-achtige structuur (Prisma of editor). */
type RawSnapItem = {
  exerciseId: string;
  order?: number;
  sets: number;
  reps: number;
  restSeconds: number;
  weightKg?: number | null;
  tempo?: string | null;
  params?: unknown;
  notes?: string | null;
} & RawGroupFields;

export function snapshotOf(template: {
  coachNote?: string | null;
  days?: {
    name: string;
    notes?: string | null;
    order?: number;
    items: RawSnapItem[];
  }[];
  /** Platte items zonder dag (legacy/fallback). */
  items?: RawSnapItem[];
}): SchemaSnapshot {
  const normItem = (it: RawSnapItem): ItemSnapshot => ({
    exerciseId: it.exerciseId,
    sets: it.sets,
    reps: it.reps,
    restSeconds: it.restSeconds,
    weightKg: it.weightKg ?? null,
    tempo: emptyToNull(it.tempo),
    params: normParams(it.params),
    notes: emptyToNull(it.notes),
    ...normGroup(it),
  });

  let days: DaySnapshot[];
  if (template.days && template.days.length > 0) {
    days = [...template.days]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((d) => ({
        name: d.name,
        notes: emptyToNull(d.notes),
        items: [...d.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(normItem),
      }));
  } else if (template.items && template.items.length > 0) {
    days = [
      {
        name: "Dag 1",
        notes: null,
        items: [...template.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(normItem),
      },
    ];
  } else {
    days = [];
  }

  return { coachNote: emptyToNull(template.coachNote), days };
}

/** Veilig een onbekende JSON-waarde (uit de DB) als snapshot interpreteren. */
export function asSnapshot(value: unknown): SchemaSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<SchemaSnapshot>;
  if (!Array.isArray(v.days)) return null;
  return {
    coachNote: emptyToNull(v.coachNote ?? null),
    days: v.days.map((d) => ({
      name: String(d?.name ?? "Dag"),
      notes: emptyToNull(d?.notes ?? null),
      items: Array.isArray(d?.items)
        ? d.items.map((it) => ({
            exerciseId: String(it?.exerciseId ?? ""),
            sets: Number(it?.sets ?? 0),
            reps: Number(it?.reps ?? 0),
            restSeconds: Number(it?.restSeconds ?? 0),
            weightKg: it?.weightKg == null ? null : Number(it.weightKg),
            tempo: emptyToNull(it?.tempo ?? null),
            params: normParams(it?.params),
            notes: emptyToNull(it?.notes ?? null),
            ...normGroup(it as RawGroupFields),
          }))
        : [],
    })),
  };
}

// --- Diff --------------------------------------------------------------------

function changedFields(a: ItemSnapshot, b: ItemSnapshot): ItemField[] {
  const out: ItemField[] = [];
  for (const f of ITEM_FIELDS) {
    if (f === "params") {
      if (stableParams(a.params) !== stableParams(b.params)) out.push(f);
    } else if (f === "group") {
      if (stableGroup(a) !== stableGroup(b)) out.push(f);
    } else if (f === "dropset") {
      if ((a.dropsetCount ?? null) !== (b.dropsetCount ?? null)) out.push(f);
    } else if (a[f] !== b[f]) {
      out.push(f);
    }
  }
  return out;
}

/**
 * Diff van `base` → `target` (wat is er in `target` anders dan in `base`).
 * Oefeningen worden binnen een dag gematcht op `exerciseId` (met
 * occurrence-index bij duplicaten); pure volgordewijzigingen worden bewust
 * genegeerd (geen inhoudelijk verschil). Overgebleven verwijderd/toegevoegd
 * paren we per positie tot "vervangen".
 */
export function diffSnapshots(base: SchemaSnapshot, target: SchemaSnapshot): SchemaDiff {
  const days: DayDiff[] = [];
  const allEntries: DiffEntry[] = [];
  const maxDays = Math.max(base.days.length, target.days.length);

  for (let di = 0; di < maxDays; di++) {
    const baseDay = base.days[di];
    const targetDay = target.days[di];

    if (!targetDay) {
      // Dag bestaat niet meer in target → verwijderd.
      days.push({
        dayIndex: di,
        name: baseDay.name,
        status: "removed",
        notesChanged: false,
        entries: [],
      });
      continue;
    }
    if (!baseDay) {
      // Nieuwe dag in target → toegevoegd (alle items als "added").
      const entries = targetDay.items.map((it, i) =>
        entry(di, targetDay.name, "added", it.exerciseId, i, { after: it })
      );
      allEntries.push(...entries);
      days.push({
        dayIndex: di,
        name: targetDay.name,
        status: "added",
        notesChanged: emptyToNull(targetDay.notes) !== null,
        entries,
      });
      continue;
    }

    const entries = diffDayItems(di, targetDay.name, baseDay.items, targetDay.items);
    allEntries.push(...entries);
    days.push({
      dayIndex: di,
      name: targetDay.name,
      status: "present",
      notesChanged: baseDay.notes !== targetDay.notes,
      entries,
    });
  }

  return {
    coachNoteChanged: base.coachNote !== target.coachNote,
    days,
    entries: allEntries,
  };
}

function entry(
  dayIndex: number,
  dayName: string,
  kind: DiffEntry["kind"],
  exerciseId: string,
  occurrence: number,
  extra: Partial<DiffEntry>
): DiffEntry {
  return {
    id: `${dayIndex}:${kind}:${exerciseId}#${occurrence}`,
    dayIndex,
    dayName,
    kind,
    exerciseId,
    ...extra,
  };
}

function diffDayItems(
  dayIndex: number,
  dayName: string,
  baseItems: ItemSnapshot[],
  targetItems: ItemSnapshot[]
): DiffEntry[] {
  const entries: DiffEntry[] = [];

  // Match op exerciseId met occurrence-index (ondersteunt dezelfde oefening 2×).
  const seenBase = new Map<string, number>();
  const baseByKey = new Map<string, { item: ItemSnapshot; pos: number }>();
  baseItems.forEach((it, pos) => {
    const occ = seenBase.get(it.exerciseId) ?? 0;
    seenBase.set(it.exerciseId, occ + 1);
    baseByKey.set(`${it.exerciseId}#${occ}`, { item: it, pos });
  });

  const seenTarget = new Map<string, number>();
  const matchedBaseKeys = new Set<string>();
  const addedLeftover: { item: ItemSnapshot; pos: number; occ: number }[] = [];

  targetItems.forEach((it, pos) => {
    const occ = seenTarget.get(it.exerciseId) ?? 0;
    seenTarget.set(it.exerciseId, occ + 1);
    const key = `${it.exerciseId}#${occ}`;
    const baseMatch = baseByKey.get(key);
    if (baseMatch) {
      matchedBaseKeys.add(key);
      const fields = changedFields(baseMatch.item, it);
      if (fields.length > 0) {
        entries.push(
          entry(dayIndex, dayName, "changed", it.exerciseId, occ, {
            before: baseMatch.item,
            after: it,
            fields,
          })
        );
      }
    } else {
      addedLeftover.push({ item: it, pos, occ });
    }
  });

  // Niet-gematchte base-items = verwijderd-kandidaten.
  const removedLeftover: { item: ItemSnapshot; pos: number; occ: number }[] = [];
  const baseOcc = new Map<string, number>();
  baseItems.forEach((it, pos) => {
    const occ = baseOcc.get(it.exerciseId) ?? 0;
    baseOcc.set(it.exerciseId, occ + 1);
    if (!matchedBaseKeys.has(`${it.exerciseId}#${occ}`)) {
      removedLeftover.push({ item: it, pos, occ });
    }
  });

  // Paar verwijderd↔toegevoegd op positie → "vervangen".
  removedLeftover.sort((a, b) => a.pos - b.pos);
  addedLeftover.sort((a, b) => a.pos - b.pos);
  const pairs = Math.min(removedLeftover.length, addedLeftover.length);
  for (let i = 0; i < pairs; i++) {
    const rm = removedLeftover[i];
    const ad = addedLeftover[i];
    entries.push(
      entry(dayIndex, dayName, "replaced", ad.item.exerciseId, ad.occ, {
        fromExerciseId: rm.item.exerciseId,
        before: rm.item,
        after: ad.item,
      })
    );
  }
  for (let i = pairs; i < removedLeftover.length; i++) {
    const rm = removedLeftover[i];
    entries.push(entry(dayIndex, dayName, "removed", rm.item.exerciseId, rm.occ, { before: rm.item }));
  }
  for (let i = pairs; i < addedLeftover.length; i++) {
    const ad = addedLeftover[i];
    entries.push(entry(dayIndex, dayName, "added", ad.item.exerciseId, ad.occ, { after: ad.item }));
  }

  return entries;
}

// --- Afgeleide helpers -------------------------------------------------------

/** Is er enig inhoudelijk verschil tussen base en target? */
export function hasAnyDiff(diff: SchemaDiff): boolean {
  return (
    diff.coachNoteChanged ||
    diff.entries.length > 0 ||
    diff.days.some((d) => d.status !== "present" || d.notesChanged)
  );
}

/** Heeft het lid de master-kopie persoonlijk aangepast? (kopie ≠ baseline) */
export function isPersonalized(personal: SchemaSnapshot, baseline: SchemaSnapshot | null): boolean {
  if (!baseline) return false;
  return hasAnyDiff(diffSnapshots(baseline, personal));
}

/** Is de master gewijzigd sinds de laatste sync? (master ≠ baseline) */
export function hasMasterChanges(master: SchemaSnapshot, baseline: SchemaSnapshot | null): boolean {
  if (!baseline) return false;
  return hasAnyDiff(diffSnapshots(baseline, master));
}

export type DiffSummary = {
  changed: number;
  added: number;
  removed: number;
  replaced: number;
  daysAdded: number;
  daysRemoved: number;
  total: number;
};

/** Kopieer één veld van `source` naar `target` (getypeerd, geen `any`). */
export function copyItemField(target: ItemSnapshot, source: ItemSnapshot, f: ItemField): void {
  switch (f) {
    case "sets":
      target.sets = source.sets;
      break;
    case "reps":
      target.reps = source.reps;
      break;
    case "weightKg":
      target.weightKg = source.weightKg;
      break;
    case "restSeconds":
      target.restSeconds = source.restSeconds;
      break;
    case "tempo":
      target.tempo = source.tempo;
      break;
    case "params":
      target.params = source.params;
      break;
    case "notes":
      target.notes = source.notes;
      break;
    case "group":
      target.groupId = source.groupId;
      target.groupType = source.groupType;
      target.groupOrder = source.groupOrder;
      target.groupRounds = source.groupRounds;
      target.groupRestSeconds = source.groupRestSeconds;
      target.groupLabel = source.groupLabel;
      target.groupTimeCapSeconds = source.groupTimeCapSeconds;
      break;
    case "dropset":
      target.dropsetCount = source.dropsetCount;
      break;
  }
}

/**
 * Pas één diff-entry toe op een snapshot (puur, retourneert een nieuwe snapshot).
 * Gebruikt om de baseline bij te werken nadat een coach één specifieke
 * master-wijziging heeft overgenomen, zodat de resterende diff klopt.
 */
export function applyEntryToSnapshot(snap: SchemaSnapshot, entry: DiffEntry): SchemaSnapshot {
  const days: DaySnapshot[] = snap.days.map((d) => ({
    ...d,
    items: d.items.map((i) => ({ ...i })),
  }));

  // Nieuwe dag (added-item in een dag die nog niet bestaat).
  while (days.length <= entry.dayIndex) {
    days.push({ name: entry.dayName, notes: null, items: [] });
  }
  const day = days[entry.dayIndex];

  if (entry.kind === "changed" && entry.after && entry.fields) {
    const it = day.items.find((i) => i.exerciseId === entry.exerciseId);
    if (it) for (const f of entry.fields) copyItemField(it, entry.after, f);
  } else if (entry.kind === "replaced" && entry.after) {
    const idx = day.items.findIndex((i) => i.exerciseId === entry.fromExerciseId);
    if (idx >= 0) day.items[idx] = { ...entry.after };
    else day.items.push({ ...entry.after });
  } else if (entry.kind === "added" && entry.after) {
    day.items.push({ ...entry.after });
  } else if (entry.kind === "removed") {
    const idx = day.items.findIndex((i) => i.exerciseId === entry.exerciseId);
    if (idx >= 0) day.items.splice(idx, 1);
  }

  return { coachNote: snap.coachNote, days };
}

/** Telt de diff-entries per categorie (voor badges/tellingen). */
export function summarizeDiff(diff: SchemaDiff): DiffSummary {
  const s: DiffSummary = {
    changed: 0,
    added: 0,
    removed: 0,
    replaced: 0,
    daysAdded: 0,
    daysRemoved: 0,
    total: 0,
  };
  for (const e of diff.entries) {
    s[e.kind] += 1;
  }
  for (const d of diff.days) {
    if (d.status === "added") s.daysAdded += 1;
    if (d.status === "removed") s.daysRemoved += 1;
  }
  s.total =
    s.changed +
    s.added +
    s.removed +
    s.replaced +
    s.daysAdded +
    s.daysRemoved +
    (diff.coachNoteChanged ? 1 : 0);
  return s;
}
