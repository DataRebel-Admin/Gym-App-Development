import { useTranslations } from "next-intl";
import { formatSessionStart } from "@/lib/datetime";
import { Check, ChevronDown } from "@/components/ui/icons";
import { ClassCard, type SessionCard } from "@/components/classes/class-card";
import { groupSessionsByClass } from "@/lib/class-groups";

/**
 * De lessenlijst gegroepeerd per lestype: één uitklapbare rij per soort in
 * plaats van tientallen losse kaarten. Bij een paar wekelijkse reeksen was de
 * lijst anders een scrollmarathon van dezelfde vier lessen.
 *
 * DE EERSTVOLGENDE LES BLIJFT INGEKLAPT ZICHTBAAR (wens eigenaar): de kop toont
 * subtiel wanneer die is, zodat je zonder uitklappen ziet wat er als eerste
 * aankomt. Welke sessie dat is, is niet zomaar de eerste van de groep — zie
 * `nextBookableSession` in lib/class-groups.ts (lopend/geannuleerd/voorbij
 * vallen af, vol telt wél mee).
 *
 * Server component met native `<details>/<summary>` — het uitklap-idioom van
 * deze repo (o.a. components/calendar/calendar-feed-card.tsx). Geen client-
 * state en geen `overflow-hidden`-hoogteanimatie: dat laatste zou het
 * absoluut gepositioneerde paneel van `ClassInfoButton` in de kaarten
 * wegknippen (zie de waarschuwing in components/classes/class-info.tsx).
 */
export function ClassGroupList({ sessions, q }: { sessions: SessionCard[]; q: string }) {
  const t = useTranslations("member.rooster");
  const groups = groupSessionsByClass(sessions);
  // Eén soort = niets te kiezen; dan is dichtklappen alleen maar een extra tik.
  const openByDefault = groups.length === 1;

  return (
    <div className="flex flex-col gap-2.5">
      {groups.map((g) => (
        <details
          key={g.classId}
          open={openByDefault}
          className="group rounded-2xl border border-border bg-surface-1 shadow-sm open:bg-surface-1"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5">
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="truncate font-display text-base font-bold text-neutral-900">
                  {g.className}
                </span>
                {g.hasMine ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                    <Check className="size-2.5" /> {t("enrolled")}
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block truncate text-xs text-neutral-500">
                {t("groupNext")}{" "}
                <span className="capitalize">
                  {formatSessionStart(g.next.startsAt, g.next.timezone)}
                </span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {/* bg-neutral-200, niet surface-2: dat token is in het lichte thema
                  gelijk aan surface-1 (#ffffff), dus de chip zou daar wegvallen. */}
              <span className="rounded-full bg-neutral-200 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
                {t("groupCount", { count: g.sessions.length })}
              </span>
              <ChevronDown className="size-4 text-neutral-400 transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <div className="flex flex-col gap-2.5 px-3 pb-3">
            {g.sessions.map((s) => (
              <ClassCard key={s.id} s={s} q={q} />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
