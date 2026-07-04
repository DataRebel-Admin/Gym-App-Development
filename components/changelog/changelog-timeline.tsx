import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  CHANGELOG,
  CHANGE_TYPE_META,
  type ChangeType,
} from "@/lib/changelog";

const dateFmt = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

// Vaste weergave-volgorde van de wijzigingstypes binnen een release.
const TYPE_ORDER: ChangeType[] = ["new", "improved", "fixed"];

/**
 * Gedeelde, presentatie-only tijdlijn van de release-notes. Bevat geen guard —
 * de pagina die 'm rendert (owner/superadmin) dwingt de toegang af.
 */
export function ChangelogTimeline() {
  return (
    <ol className="flex flex-col gap-5">
      {CHANGELOG.map((entry, index) => (
        <li key={entry.version} className="relative">
          <Card variant={index === 0 ? "elevated" : "default"}>
            <div className="flex flex-col gap-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={index === 0 ? "accent" : "neutral"}>
                  {entry.version}
                </Badge>
                {index === 0 ? <Badge tone="success">Nieuwste</Badge> : null}
                <span className="ml-auto text-xs font-medium text-neutral-500">
                  {formatDate(entry.date)}
                </span>
              </div>

              <div>
                <h2 className="font-display text-lg font-bold tracking-tight text-neutral-900">
                  {entry.title}
                </h2>
                {entry.summary ? (
                  <p className="mt-1 text-sm text-neutral-500">{entry.summary}</p>
                ) : null}
              </div>

              <ul className="flex flex-col gap-2.5">
                {[...entry.changes]
                  .sort(
                    (a, b) =>
                      TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)
                  )
                  .map((change, i) => {
                    const meta = CHANGE_TYPE_META[change.type];
                    return (
                      <li key={i} className="flex items-start gap-3">
                        <Badge tone={meta.tone} className="mt-0.5 shrink-0">
                          {meta.label}
                        </Badge>
                        <span className="text-sm text-neutral-700">
                          {change.text}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </div>
          </Card>
        </li>
      ))}
    </ol>
  );
}
