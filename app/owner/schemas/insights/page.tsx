import Link from "next/link";
import { requireOwner } from "@/lib/owner";
import { getCoachInsights } from "@/lib/coach-insights";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Coach-analyse" };

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border p-5">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        {hint ? <p className="text-sm text-neutral-500">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default async function CoachInsightsPage() {
  const owner = await requireOwner();
  const insights = await getCoachInsights(owner.tenantId);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge tone="neutral">{insights.totals.assignments} toewijzingen</Badge>
        <Badge tone="warning">{insights.totals.personalized} gepersonaliseerd</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="Vaakst aangepaste oefeningen"
          hint="Oefeningen die leden het meest afwijken van de master — kandidaat om de master bij te stellen."
        >
          {insights.topOverriddenExercises.length === 0 ? (
            <p className="text-sm text-neutral-500">Nog geen aanpassingen.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {insights.topOverriddenExercises.map((e) => (
                <li key={e.exerciseId} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-800">{e.name}</span>
                  <Badge tone="accent">{e.count}×</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Leden met de meeste aanpassingen"
          hint="Wie krijgt het meeste maatwerk."
        >
          {insights.membersWithOverrides.length === 0 ? (
            <p className="text-sm text-neutral-500">Nog geen aanpassingen.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {insights.membersWithOverrides.map((m) => (
                <li key={m.userId} className="flex items-center justify-between text-sm">
                  <Link
                    href={`/owner/schemas/members/${m.userId}`}
                    className="text-accent hover:underline"
                  >
                    {m.name}
                  </Link>
                  <Badge tone="warning">{m.count} aanpassingen</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Schema's die afwijken van de master"
          hint="Per master: hoeveel toewijzingen gepersonaliseerd zijn."
        >
          {insights.deviatingSchemas.length === 0 ? (
            <p className="text-sm text-neutral-500">Nog geen schema's toegewezen.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {insights.deviatingSchemas.map((s) => (
                <li key={s.masterId} className="flex items-center justify-between text-sm">
                  <Link
                    href={`/owner/schemas/templates/${s.masterId}`}
                    className="text-accent hover:underline"
                  >
                    {s.name}
                  </Link>
                  <span className="text-neutral-600">
                    {s.deviating}/{s.total} afwijkend
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Leden die achterlopen"
          hint={`Geen training in ${10}+ dagen (of nog nooit getraind).`}
        >
          {insights.laggingMembers.length === 0 ? (
            <p className="text-sm text-neutral-500">Iedereen is recent actief geweest. 💪</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {insights.laggingMembers.map((m) => (
                <li key={m.userId} className="flex items-center justify-between text-sm">
                  <Link
                    href={`/owner/schemas/members/${m.userId}`}
                    className="text-accent hover:underline"
                  >
                    {m.name}
                  </Link>
                  <Badge tone="danger">
                    {m.daysSince === null ? "nooit getraind" : `${m.daysSince} dagen`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
