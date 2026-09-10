import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Bezetting per lestype. De grafiek ernaast toont het gemiddelde over alle
 * lessen; de beslissing van een eigenaar hangt juist aan het verschil tussen
 * lestypes ("Spinning zit vol, Yoga draait op 30%").
 *
 * `waitlisted` is de onbediende vraag: mensen die erin wilden maar niet
 * konden. Dat cijfer werd nergens getoond terwijl het het duidelijkste signaal
 * is om een sessie bij te plannen.
 *
 * UI hardcoded NL (precedent onderhoud/defecten in de owner-area).
 */
export type ClassTypeRow = {
  classId: string;
  className: string;
  sessions: number;
  occupancyPct: number | null;
  noShowPct: number | null;
  waitlisted: number;
};

function occupancyTone(pct: number | null): string {
  if (pct === null) return "text-neutral-400";
  if (pct >= 90) return "text-green-700";
  if (pct >= 50) return "text-neutral-900";
  return "text-amber-700";
}

export function ClassTypeTable({ rows }: { rows: ClassTypeRow[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between gap-2">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-lg">Per lestype</CardTitle>
          <p className="text-sm text-neutral-500">
            Welke les zit vol en welke draait leeg. Wachtlijst = vraag die je nog niet bedient.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-500">
            Nog geen afgeronde lessen in deze periode.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-neutral-500">
                  <th className="py-2 pr-3 font-medium">Les</th>
                  <th className="py-2 pr-3 text-right font-medium">Sessies</th>
                  <th className="py-2 pr-3 text-right font-medium">Bezetting</th>
                  <th className="py-2 pr-3 text-right font-medium">No-show</th>
                  <th className="py-2 text-right font-medium">Wachtlijst</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.classId} className="border-b border-neutral-100 last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-neutral-900">{r.className}</td>
                    <td className="py-2.5 pr-3 text-right text-neutral-500">{r.sessions}</td>
                    <td className={`py-2.5 pr-3 text-right font-semibold ${occupancyTone(r.occupancyPct)}`}>
                      {r.occupancyPct === null ? "–" : `${r.occupancyPct}%`}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-neutral-500">
                      {r.noShowPct === null ? "–" : `${r.noShowPct}%`}
                    </td>
                    <td className="py-2.5 text-right">
                      {r.waitlisted > 0 ? (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                          {r.waitlisted}
                        </span>
                      ) : (
                        <span className="text-neutral-400">–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
