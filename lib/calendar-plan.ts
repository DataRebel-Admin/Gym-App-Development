/**
 * Pure kern van de ledenagenda: de weekdagplanning op een schematoewijzing
 * (`AssignedWorkout.weekdayPlan`) en de afleiding "wat is de status van een
 * geplande trainingsdag op datum X".
 *
 * Géén `server-only` (idioom lib/exercise-types.ts): ook client- en
 * test-bruikbaar. Alle datums zijn dayKey-strings ("YYYY-MM-DD") die de caller
 * al in de juiste tijdzone heeft bepaald (dayKeyInTz in lib/metrics/definitions
 * of zonedParts in lib/tz.ts) — deze module rekent uitsluitend puur op
 * kalenderdagen via Date.UTC en is daarmee DST-vrij.
 *
 * Weekdag-conventie: ISO 8601, 1 = maandag … 7 = zondag. Dit is de opgeslagen
 * vorm (overleeft code) — de interne 0=ma-conventie van hourPartsInTz/
 * weekStartKeyInTz wordt uitsluitend hier, in isoWeekdayOfDayKey, geraakt.
 *
 * Tests: tests/calendar-plan.test.ts.
 */

export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type WeekdayPlan = {
  /** Eerste instelmoment ("YYYY-MM-DD"); latere bewerkingen laten dit staan. */
  setAt: string;
  /** dayId → weekdagen (ISO 1..7). Een dag mag ontbreken (= ongepland). */
  days: Record<string, IsoWeekday[]>;
};

export type DayRef = { id: string; name: string; order: number };

/**
 * Status van een geplande trainingsdag op een concrete datum:
 * - done: die dag getraind (zelfde dayId op dezelfde datum, of een sessie
 *   zonder dayId op dezelfde datum);
 * - shifted: elders in dezélfde ISO-week getraind met dit dayId (verschoven,
 *   telt als gedaan — niet gemist);
 * - upcoming: in de toekomst;
 * - pending: gepasseerd maar de week loopt nog ("nog niet gedaan", neutraal —
 *   de verschoven-regel kan 'm deze week nog inlossen);
 * - missed: afgesloten week en niet (elders) gedaan.
 */
export type PlannedDayStatus = "done" | "shifted" | "upcoming" | "pending" | "missed";

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MS_PER_DAY = 86_400_000;

function isIsoWeekday(v: unknown): v is IsoWeekday {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 7;
}

function utcOf(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function keyOf(utcMs: number): string {
  const d = new Date(utcMs);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

/** Is dit een geldige dayKey ("YYYY-MM-DD") met een bestaande kalenderdag? */
export function isValidDayKey(v: string): boolean {
  return DAY_KEY_RE.test(v) && keyOf(utcOf(v)) === v;
}

/** Is dit een geldige maandsleutel ("YYYY-MM")? */
export function isValidMonthKey(v: string): boolean {
  return MONTH_KEY_RE.test(v);
}

/**
 * Parse/valideer de opgeslagen JSON-vorm. Ongeldige weekdagwaarden vallen weg,
 * weekdagen worden gededupliceerd en gesorteerd, lege entries vervallen.
 * Structureel kapot of niets over → null (= geen plan).
 */
export function parseWeekdayPlan(json: unknown): WeekdayPlan | null {
  if (typeof json !== "object" || json === null || Array.isArray(json)) return null;
  const obj = json as Record<string, unknown>;
  const setAt = obj.setAt;
  if (typeof setAt !== "string" || !isValidDayKey(setAt)) return null;
  const rawDays = obj.days;
  if (typeof rawDays !== "object" || rawDays === null || Array.isArray(rawDays)) return null;

  const days: Record<string, IsoWeekday[]> = {};
  for (const [dayId, value] of Object.entries(rawDays as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    const weekdays = [...new Set(value.filter(isIsoWeekday))].sort((a, b) => a - b);
    if (weekdays.length > 0) days[dayId] = weekdays;
  }
  if (Object.keys(days).length === 0) return null;
  return { setAt, days };
}

function normName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Draag een weekdagplan over naar een nieuwe toewijzing (hertoewijzing kloont
 * de dagen met nieuwe ids). Matchen op naam (getrimd, hoofdletterongevoelig;
 * bij dubbele namen wint gelijke volgorde), anders op volgorde; ongematchte
 * dagen vervallen. `setAt` reist mee (anders reset elke hertoewijzing de
 * gemist-historie). Niets over → null.
 */
export function carryOverWeekdayPlan(
  plan: WeekdayPlan,
  oldDays: DayRef[],
  newDays: DayRef[]
): WeekdayPlan | null {
  const used = new Set<string>();
  const days: Record<string, IsoWeekday[]> = {};

  // In volgorde van de oude dagen, zodat naam-tiebreaks deterministisch zijn.
  const plannedOld = oldDays.filter((d) => plan.days[d.id]?.length);
  for (const old of plannedOld) {
    const byName = newDays.filter((n) => !used.has(n.id) && normName(n.name) === normName(old.name));
    const target =
      byName.find((n) => n.order === old.order) ??
      byName[0] ??
      newDays.find((n) => !used.has(n.id) && n.order === old.order);
    if (!target) continue;
    used.add(target.id);
    days[target.id] = [...plan.days[old.id]];
  }
  if (Object.keys(days).length === 0) return null;
  return { setAt: plan.setAt, days };
}

/** ISO-weekdag (1=ma … 7=zo) van een dayKey. Enige 0/7-conversiepunt. */
export function isoWeekdayOfDayKey(dayKey: string): IsoWeekday {
  const js = new Date(utcOf(dayKey)).getUTCDay(); // 0=zo … 6=za
  return (js === 0 ? 7 : js) as IsoWeekday;
}

/** dayKey van de maandag van de ISO-week waarin `dayKey` valt. */
export function weekStartKeyOfDayKey(dayKey: string): string {
  return keyOf(utcOf(dayKey) - (isoWeekdayOfDayKey(dayKey) - 1) * MS_PER_DAY);
}

/** Telt kalenderdagen bij een dayKey op (negatief mag). */
export function addDaysToDayKey(dayKey: string, days: number): string {
  return keyOf(utcOf(dayKey) + days * MS_PER_DAY);
}

/** Welke geplande trainingsdagen (dayIds) vallen op deze datum? */
export function plannedDayIdsOnDate(plan: WeekdayPlan, dayKey: string): string[] {
  const weekday = isoWeekdayOfDayKey(dayKey);
  return Object.keys(plan.days).filter((dayId) => plan.days[dayId].includes(weekday));
}

export type PlannedStatusArgs = {
  plan: WeekdayPlan;
  /** De beoordeelde kalenderdag. */
  dayKey: string;
  /** "Vandaag" in de tijdzone van het lid. */
  todayKey: string;
  /** Afgeronde sessies in dezélfde ISO-week als `dayKey` (dayKey per sessie). */
  sessionsOfWeek: { dayId: string | null; dayKey: string }[];
  /** Geldig-vanaf van de toewijzing (dayKey), null = onbegrensd. */
  windowStartKey: string | null;
  /** Geldig-t/m van de toewijzing (dayKey, inclusief), null = open. */
  windowEndKey: string | null;
};

/**
 * Status per geplande trainingsdag op één datum. Spec-regels:
 * - buiten het toewijzingsvenster of vóór `setAt` → geen verwachting ([]);
 * - zelfde dayId op dezelfde datum → done; zelfde dayId elders in de week →
 *   shifted; een sessie zónder dayId op dezelfde datum → done (één zo'n sessie
 *   dekt maximaal één geplande dag);
 * - toekomst → upcoming; lopende week → pending; afgesloten week → missed.
 */
export function plannedDayStatuses(
  args: PlannedStatusArgs
): { dayId: string; status: PlannedDayStatus }[] {
  const { plan, dayKey, todayKey, sessionsOfWeek, windowStartKey, windowEndKey } = args;
  // Lexicografische vergelijking is veilig: dayKeys zijn "YYYY-MM-DD".
  if (windowStartKey && dayKey < windowStartKey) return [];
  if (windowEndKey && dayKey > windowEndKey) return [];
  if (dayKey < plan.setAt) return [];

  const plannedIds = plannedDayIdsOnDate(plan, dayKey);
  if (plannedIds.length === 0) return [];

  const weekStart = weekStartKeyOfDayKey(dayKey);
  const inWeek = sessionsOfWeek.filter((s) => weekStartKeyOfDayKey(s.dayKey) === weekStart);
  let daylessToday = inWeek.filter((s) => s.dayId === null && s.dayKey === dayKey).length;

  return plannedIds.map((dayId) => {
    if (inWeek.some((s) => s.dayId === dayId && s.dayKey === dayKey)) {
      return { dayId, status: "done" as const };
    }
    if (inWeek.some((s) => s.dayId === dayId)) {
      return { dayId, status: "shifted" as const };
    }
    if (daylessToday > 0) {
      daylessToday -= 1;
      return { dayId, status: "done" as const };
    }
    if (dayKey > todayKey) return { dayId, status: "upcoming" as const };
    if (weekStart === weekStartKeyOfDayKey(todayKey)) return { dayId, status: "pending" as const };
    return { dayId, status: "missed" as const };
  });
}

/**
 * Alle dayKeys van het maandraster: de maandag op of vóór de 1e t/m de zondag
 * op of na de laatste dag van de maand (altijd een veelvoud van 7).
 */
export function monthGridDayKeys(monthKey: string): string[] {
  const [y, m] = monthKey.split("-").map(Number);
  const firstKey = `${monthKey}-01`;
  const lastKey = keyOf(Date.UTC(y, m, 0)); // dag 0 van de volgende maand = laatste dag
  const start = weekStartKeyOfDayKey(firstKey);
  const end = addDaysToDayKey(weekStartKeyOfDayKey(lastKey), 6);
  const out: string[] = [];
  for (let k = start; k <= end; k = addDaysToDayKey(k, 1)) out.push(k);
  return out;
}

/** Maandsleutel ("YYYY-MM") waarin een dayKey valt. */
export function monthKeyOfDayKey(dayKey: string): string {
  return dayKey.slice(0, 7);
}

/** Vorige maand, jaarwissel-veilig. */
export function prevMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Volgende maand, jaarwissel-veilig. */
export function nextMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}
