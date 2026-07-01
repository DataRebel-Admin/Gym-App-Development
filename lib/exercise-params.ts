// Pure helpers rond oefening-parameters: parsing/validatie, mapping naar de
// (legacy) WorkoutExerciseItem/PerformanceEntry-kolommen + JSON, en de centrale
// samenvattingsformatter. Géén `server-only` (ook door client gebruikt).
//
// Canonieke opslag: numerieke waarden zoals ingevoerd, MAAR durations altijd in
// seconden en afstanden altijd in meters (zie ParamField.kind in
// lib/exercise-types.ts). De UI converteert via toInputValue/parseFieldInput.

import {
  getExerciseType,
  type ParamField,
} from "@/lib/exercise-types";

export type ParamValue = number | string;
export type ParamMap = Record<string, ParamValue>;

/** Waarden voor de bestaande WorkoutExerciseItem-kolommen + restjes in JSON. */
export type ItemColumns = {
  sets: number;
  reps: number;
  restSeconds: number;
  weightKg: number | null;
  tempo: string | null;
  params: ParamMap | null;
};

/** Vorm van een WorkoutExerciseItem-rij voor de reconstructie-helpers. */
type ItemRow = {
  sets: number;
  reps: number;
  restSeconds: number;
  weightKg: number | null;
  tempo?: string | null;
  params?: unknown;
};

const COLUMN_DEFAULTS = { sets: 1, reps: 0, restSeconds: 0 } as const;

// --- Input-conversie (UI ⇄ canoniek) -------------------------------------

/** Canonieke waarde → weergavewaarde voor een tekstinput (string). */
export function toInputValue(field: ParamField, value: ParamValue | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") return value;
  if (field.kind === "duration" && field.unit === "min") {
    return String(round(value / 60, 2));
  }
  if (field.kind === "distance" && field.unit === "km") {
    return String(round(value / 1000, 3));
  }
  return String(value);
}

/**
 * Ruwe invoer (form-string of getal) → canonieke waarde, of null (leeg).
 * Retourneert een fout wanneer een verplicht veld leeg is of een enum/getal
 * ongeldig is.
 */
export function parseFieldInput(
  field: ParamField,
  raw: unknown
): { ok: true; value: ParamValue | null } | { ok: false; error: string } {
  const empty =
    raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "");

  if (empty) {
    if (field.required) return { ok: false, error: `${field.label} is verplicht` };
    return { ok: true, value: null };
  }

  if (field.kind === "enum") {
    const v = String(raw);
    if (!field.options?.some((o) => o.value === v)) {
      return { ok: false, error: `Ongeldige waarde voor ${field.label}` };
    }
    return { ok: true, value: v };
  }

  if (field.kind === "text") {
    return { ok: true, value: String(raw).trim().slice(0, 500) };
  }

  // Numeriek (int/float/duration/distance).
  const num = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(num)) {
    return { ok: false, error: `${field.label} moet een getal zijn` };
  }

  let canonical = num;
  if (field.kind === "duration" && field.unit === "min") canonical = num * 60;
  else if (field.kind === "distance" && field.unit === "km") canonical = num * 1000;

  if (field.kind === "int" || field.kind === "duration") canonical = Math.round(canonical);
  else canonical = round(canonical, 3);

  if (canonical < 0) canonical = 0;
  if (field.min !== undefined && canonical < field.min) {
    // min geldt op invoer-eenheid → vergelijk op canoniek waar mogelijk.
    return { ok: false, error: `${field.label} is te laag` };
  }
  if (field.max !== undefined && canonical > field.max) {
    return { ok: false, error: `${field.label} is te hoog` };
  }
  return { ok: true, value: canonical };
}

// --- Validatie over een veldset ------------------------------------------

function validateFields(
  fields: ParamField[],
  raw: Record<string, unknown>
): { ok: true; params: ParamMap } | { ok: false; error: string } {
  const params: ParamMap = {};
  for (const field of fields) {
    const res = parseFieldInput(field, raw[field.id]);
    if (!res.ok) return res;
    if (res.value !== null) params[field.id] = res.value;
  }
  return { ok: true, params };
}

/** Valideer de doel-parameters (schema-editor) voor een oefeningstype. */
export function validateItemParams(typeKey: string, raw: Record<string, unknown>) {
  return validateFields(getExerciseType(typeKey).targetFields, raw);
}

/** Valideer de log-parameters (live tracking) voor een oefeningstype. */
export function validateLogParams(typeKey: string, raw: Record<string, unknown>) {
  return validateFields(getExerciseType(typeKey).logFields, raw);
}

// --- Mapping canoniek ⇄ DB-kolommen --------------------------------------

/** Split canonieke doel-params in de legacy-kolommen + JSON-rest. */
export function itemColumnsFromParams(typeKey: string, params: ParamMap): ItemColumns {
  const type = getExerciseType(typeKey);
  const cols: ItemColumns = {
    sets: COLUMN_DEFAULTS.sets,
    reps: COLUMN_DEFAULTS.reps,
    restSeconds: COLUMN_DEFAULTS.restSeconds,
    weightKg: null,
    tempo: null,
    params: null,
  };
  const rest: ParamMap = {};

  for (const field of type.targetFields) {
    const value = params[field.id];
    if (value === undefined) continue;
    if (field.column === "sets") cols.sets = asInt(value, COLUMN_DEFAULTS.sets);
    else if (field.column === "reps") cols.reps = asInt(value, COLUMN_DEFAULTS.reps);
    else if (field.column === "restSeconds")
      cols.restSeconds = asInt(value, COLUMN_DEFAULTS.restSeconds);
    else if (field.column === "weightKg") cols.weightKg = asFloat(value);
    else if (field.column === "tempo") cols.tempo = String(value).trim() || null;
    else rest[field.id] = value;
  }
  cols.params = Object.keys(rest).length > 0 ? rest : null;
  return cols;
}

/** Reconstrueer de canonieke param-map uit een WorkoutExerciseItem-rij. */
export function paramsFromItem(item: ItemRow, typeKey: string): ParamMap {
  const type = getExerciseType(typeKey);
  const json = isRecord(item.params) ? item.params : {};
  const out: ParamMap = {};
  for (const field of type.targetFields) {
    if (field.column === "sets") out.sets = item.sets;
    else if (field.column === "reps") out.reps = item.reps;
    else if (field.column === "restSeconds") out.restSeconds = item.restSeconds;
    else if (field.column === "weightKg") {
      if (item.weightKg !== null && item.weightKg !== undefined) out.weightKg = item.weightKg;
    } else if (field.column === "tempo") {
      if (item.tempo) out.tempo = item.tempo;
    } else {
      const v = json[field.id];
      if (typeof v === "number" || typeof v === "string") out[field.id] = v;
    }
  }
  return out;
}

/** Split canonieke log-params in de PerformanceEntry-kolommen + JSON-rest. */
export function logColumnsFromParams(
  typeKey: string,
  params: ParamMap
): { reps: number; weightKg: number; params: ParamMap | null } {
  const type = getExerciseType(typeKey);
  let reps = 0;
  let weightKg = 0;
  const rest: ParamMap = {};
  for (const field of type.logFields) {
    const value = params[field.id];
    if (value === undefined) continue;
    if (field.column === "reps") reps = asInt(value, 0);
    else if (field.column === "weightKg") weightKg = asFloat(value) ?? 0;
    else rest[field.id] = value;
  }
  return { reps, weightKg, params: Object.keys(rest).length > 0 ? rest : null };
}

// --- Weergave -------------------------------------------------------------

function durationLabel(seconds: number): string {
  const s = Math.round(seconds);
  if (s <= 0) return "0 sec";
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m === 0) return `${rest} sec`;
  if (rest === 0) return `${m} min`;
  return `${m}m ${rest}s`;
}

function distanceLabel(meters: number): string {
  if (meters >= 1000) return `${round(meters / 1000, 2)} km`;
  return `${Math.round(meters)} m`;
}

/** Eén parameter → leesbare string ("30 min", "5 km", "Zone 3", "70 kg"). */
export function formatParamValue(field: ParamField, value: ParamValue): string {
  switch (field.kind) {
    case "duration":
      return durationLabel(Number(value));
    case "distance":
      return distanceLabel(Number(value));
    case "enum":
      return field.options?.find((o) => o.value === value)?.label ?? String(value);
    case "text":
      return String(value);
    default: {
      const n = Number(value);
      return field.unit ? `${n} ${field.unit}` : String(n);
    }
  }
}

/**
 * Centrale samenvatting van een schema-item ("4 × 10 @ 70 kg" of
 * "30 min · 5 km · Zone 3"). Gebruikt door de checklist, PDF, het
 * owner-overzicht én de editor-preview — geen weergave-duplicatie.
 */
export function formatItemSummary(typeKey: string, params: ParamMap): string {
  const type = getExerciseType(typeKey);

  // Vertrouwde kracht-notatie behouden.
  if (type.key === "strength") {
    const sets = num(params.sets) ?? 0;
    const reps = num(params.reps) ?? 0;
    const head = sets && reps ? `${sets} × ${reps}` : sets ? `${sets} sets` : "";
    const w = num(params.weightKg);
    const weight = w ? ` @ ${w} kg` : "";
    return (head + weight).trim() || "—";
  }

  const parts: string[] = [];
  for (const field of type.targetFields) {
    if (field.kind === "text") continue; // vrije tekst niet in de korte regel
    const value = params[field.id];
    if (value === undefined || value === "") continue;
    if (field.id === "rounds") {
      parts.push(`${num(value)} rondes`);
      continue;
    }
    parts.push(formatParamValue(field, value));
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

/** Korte tekst voor het type-doel zoals de sporter het ziet (incl. type-label valt elders). */
export function targetSummaryFromItem(item: ItemRow, typeKey: string): string {
  return formatItemSummary(typeKey, paramsFromItem(item, typeKey));
}

// --- Editor-helpers (input-string-maps per veld-id) -----------------------

export type InputValues = Record<string, string>;

/** Standaard invoerwaarden voor een nieuw item van een type (uit field.default). */
export function defaultInputValues(typeKey: string): InputValues {
  const type = getExerciseType(typeKey);
  const out: InputValues = {};
  for (const field of type.targetFields) {
    out[field.id] = field.default !== undefined ? toInputValue(field, field.default) : "";
  }
  return out;
}

/** Bestaand item → invoerwaarden (lege string voor afwezige velden). */
export function itemToInputValues(item: ItemRow, typeKey: string): InputValues {
  const params = paramsFromItem(item, typeKey);
  const type = getExerciseType(typeKey);
  const out: InputValues = {};
  for (const field of type.targetFields) {
    const v = params[field.id];
    out[field.id] = v === undefined ? "" : toInputValue(field, v);
  }
  return out;
}

/** Invoerwaarden → canonieke param-map (best-effort; ongeldige/leeg → weggelaten). */
export function paramsFromInputValues(typeKey: string, values: InputValues): ParamMap {
  const type = getExerciseType(typeKey);
  const out: ParamMap = {};
  for (const field of type.targetFields) {
    const res = parseFieldInput(field, values[field.id]);
    if (res.ok && res.value !== null) out[field.id] = res.value;
  }
  return out;
}

/** Live samenvatting vanuit invoerwaarden (editor-preview). */
export function summaryFromInputValues(typeKey: string, values: InputValues): string {
  return formatItemSummary(typeKey, paramsFromInputValues(typeKey, values));
}

// --- Tracking-helpers (logFields i.p.v. targetFields) ---------------------

/** Invoerwaarden → canonieke log-params (best-effort, over de logFields). */
export function logParamsFromInputValues(typeKey: string, values: InputValues): ParamMap {
  const type = getExerciseType(typeKey);
  const out: ParamMap = {};
  for (const field of type.logFields) {
    const res = parseFieldInput(field, values[field.id]);
    if (res.ok && res.value !== null) out[field.id] = res.value;
  }
  return out;
}

/** Standaard (lege) log-invoerwaarden voor een nieuw set/resultaat. */
export function defaultLogInputValues(typeKey: string): InputValues {
  const type = getExerciseType(typeKey);
  const out: InputValues = {};
  for (const field of type.logFields) out[field.id] = "";
  return out;
}

/** Bestaande PerformanceEntry → log-invoerwaarden (rehydratatie). */
export function entryToLogInputValues(
  entry: { reps: number; weightKg: number; params?: unknown },
  typeKey: string
): InputValues {
  const type = getExerciseType(typeKey);
  const json = isRecord(entry.params) ? entry.params : {};
  const out: InputValues = {};
  for (const field of type.logFields) {
    let canonical: ParamValue | undefined;
    if (field.column === "reps") canonical = entry.reps;
    else if (field.column === "weightKg") canonical = entry.weightKg;
    else {
      const v = json[field.id];
      if (typeof v === "number" || typeof v === "string") canonical = v;
    }
    out[field.id] = canonical === undefined ? "" : toInputValue(field, canonical);
  }
  return out;
}

/** Korte samenvatting van een gelogd resultaat (over de logFields). */
export function formatLogSummary(typeKey: string, params: ParamMap): string {
  const type = getExerciseType(typeKey);
  const parts: string[] = [];
  for (const field of type.logFields) {
    if (field.kind === "text") continue;
    const value = params[field.id];
    if (value === undefined || value === "") continue;
    parts.push(formatParamValue(field, value));
  }
  return parts.join(" · ");
}

// --- kleine utils ---------------------------------------------------------

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
function asInt(v: ParamValue, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}
function asFloat(v: ParamValue): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
function num(v: ParamValue | undefined): number | null {
  if (v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
