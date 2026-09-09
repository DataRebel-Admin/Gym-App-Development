/**
 * Groeperen van groepslessen per lestype voor de ledenlijst op /member/rooster.
 *
 * Puur en dependency-vrij (géén `server-only`, ook client bruikbaar — idioom
 * `lib/exercise-types.ts`), zodat de keuze van "de eerstvolgende les" op één
 * plek staat en getest is: die regel is niet triviaal, want de lijst bevat óók
 * lopende en geannuleerde sessies.
 *
 * GROEPEREN GAAT OP `classId`, NOOIT OP DE NAAM. `GroupClass` heeft geen
 * unique op (tenantId, name) en de naam is vrije tekst van de sportschool, dus
 * twee lestypes mogen dezelfde naam dragen; op naam groeperen zou die twee
 * stilzwijgend samenvoegen.
 */

/** Het minimum dat een sessie moet dragen om gegroepeerd te kunnen worden. */
export type GroupableSession = {
  /** Stabiele identiteit van het lestype (`GroupClass.id`). */
  classId: string;
  className: string;
  startsAt: Date;
  /** Geannuleerd door de sportschool: niet meer boekbaar. */
  cancelled: boolean;
  /** Aanmeldvenster dicht (les is begonnen). */
  started: boolean;
  /** Al afgelopen — komt alleen in de agenda-weergave voor. */
  past: boolean;
  /** Eigen deelname: aangemeld, wachtlijst of niets. */
  mine: "enrolled" | "waitlisted" | null;
};

export type ClassGroup<T extends GroupableSession> = {
  classId: string;
  className: string;
  /** Chronologisch, in de volgorde waarin ze binnenkwamen. */
  sessions: T[];
  /**
   * De les die we ook ingeklapt tonen: de eerstvolgende waar je nog iets mee
   * kunt. Terugval op de eerste sessie zodat een groep nooit leeg oogt.
   */
  next: T;
  /** Zit het lid ergens in deze groep (aangemeld of wachtlijst)? */
  hasMine: boolean;
};

/**
 * De eerstvolgende bruikbare sessie. Een VOLLE les telt bewust wél mee: vol
 * betekent wachtlijst, geen gesloten deur (`decideEnroll` in
 * lib/class-attendance.ts). Gestart, geannuleerd en voorbij vallen af.
 */
export function nextBookableSession<T extends GroupableSession>(sessions: readonly T[]): T | null {
  return sessions.find((s) => !s.cancelled && !s.started && !s.past) ?? null;
}

/**
 * Groepeer op lestype met behoud van volgorde: de aanroeper levert de sessies
 * chronologisch aan (`orderBy: { startsAt: "asc" }`), dus de groepsvolgorde is
 * automatisch die van de eerstvolgende les per type — precies de volgorde
 * waarin een lid ze wil zien.
 */
export function groupSessionsByClass<T extends GroupableSession>(
  sessions: readonly T[]
): ClassGroup<T>[] {
  const byClass = new Map<string, T[]>();
  for (const s of sessions) {
    const bucket = byClass.get(s.classId);
    if (bucket) bucket.push(s);
    else byClass.set(s.classId, [s]);
  }
  return [...byClass.entries()].map(([classId, group]) => ({
    classId,
    className: group[0].className,
    sessions: group,
    next: nextBookableSession(group) ?? group[0],
    hasMine: group.some((s) => s.mine !== null),
  }));
}
