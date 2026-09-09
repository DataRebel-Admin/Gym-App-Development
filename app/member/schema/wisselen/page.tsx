import Link from "next/link";
import { requireMember, getSwitchableSchemas } from "@/lib/member";
import { getMemberSchemaMode } from "@/lib/member-schema";
import { getRunningSessionStart } from "@/lib/session-timeout";
import { getCurrentTenant } from "@/lib/tenant";
import { schemaImage } from "@/lib/schema-image";
import { fmtSince } from "@/lib/schema-status";
import {
  canMakeActive,
  switchState,
  SWITCH_STATE_META,
  ORIGIN_LABEL,
} from "@/lib/schema-switch";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SchemaCover } from "@/components/schema/schema-cover";
import { ChevronLeft, Dumbbell, Layers, Play, Repeat } from "@/components/ui/icons";
import { switchActiveSchema, startOneOffFromAssignment } from "../actions";

export const metadata = { title: "Schema wisselen" };

/**
 * Wisselpagina: alle schema's van het lid (eigen + van de trainer) in één lijst.
 * "Maak actief" wisselt het actieve schema (het vorige blijft bewaard, dus
 * terugwisselen kan altijd); "Eenmalig trainen" start een sessie op een ander
 * schema zonder te wisselen. Regels in lib/schema-switch.ts.
 */
export default async function MemberSwitchSchemaPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const member = await requireMember();
  const { err } = await searchParams;
  const [schemas, tenant, mode, running] = await Promise.all([
    getSwitchableSchemas(member.id, member.tenantId),
    getCurrentTenant(),
    getMemberSchemaMode(member.tenantId),
    getRunningSessionStart(member.tenantId, member.id),
  ]);
  const now = new Date();
  const branding = { logoUrl: tenant?.logoUrl ?? null };
  const canBuild = mode !== "DISABLED";

  return (
    <div className="flex flex-1 flex-col gap-5 px-5 py-6">
      <div className="flex items-center gap-2">
        <Link
          href="/member/schema"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 active:text-neutral-900"
        >
          <ChevronLeft className="size-4" /> Mijn schema
        </Link>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          Schema wisselen
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Kies welk schema je actief wilt hebben, of train eenmalig met een ander schema
          zonder te wisselen.
        </p>
      </div>

      {err ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Dat schema is nu niet beschikbaar om mee te trainen.
        </div>
      ) : null}

      {running ? (
        <div className="rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-neutral-700">
          Je training loopt nog en blijft op haar eigen schema staan, ook als je hier
          wisselt.{" "}
          <Link href="/member/schema/active" className="font-semibold text-accent">
            Terug naar de training
          </Link>
        </div>
      ) : null}

      {schemas.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="size-8 text-accent" />}
          title="Nog niets om te wisselen"
          description="Zodra je trainer je een schema geeft of je zelf een schema vastlegt, verschijnt het hier."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {schemas.map((s) => {
            const tpl = s.template!;
            const row = { ...s, hasTemplate: true };
            const state = switchState(row, s.isActive);
            const meta = SWITCH_STATE_META[state];
            const switchable = !s.isActive && canMakeActive(row, now);
            const multiDay = tpl.days.length > 1;
            const since =
              s.isActive && s.publishedAt ? `Actief sinds ${fmtSince(s.publishedAt)}` : null;
            return (
              <li
                key={s.id}
                className={
                  s.isActive
                    ? "flex flex-col gap-3 rounded-2xl border border-accent/40 bg-surface-1 p-4 shadow-accent/10"
                    : "flex flex-col gap-3 rounded-2xl border border-border bg-surface-1 p-4"
                }
              >
                <div className="flex items-center gap-3">
                  <SchemaCover
                    image={schemaImage(tpl, branding)}
                    alt={tpl.name}
                    aspect={false}
                    className="h-16 w-24 shrink-0 rounded-xl"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-bold text-neutral-900">{tpl.name}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {ORIGIN_LABEL[s.origin]} · {tpl.days.length}{" "}
                      {tpl.days.length === 1 ? "dag" : "dagen"} · {tpl._count.items} oefeningen
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      {since ? <span className="text-xs text-neutral-400">{since}</span> : null}
                    </div>
                  </div>
                </div>

                {s.isActive ? (
                  <Link
                    href="/member/schema"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-neutral-700 active:bg-surface-2"
                  >
                    <Play className="size-4 fill-current text-accent" /> Naar mijn schema
                  </Link>
                ) : (
                  <div className="flex flex-col gap-2">
                    {switchable ? (
                      <form action={switchActiveSchema}>
                        <input type="hidden" name="assignmentId" value={s.id} />
                        <button
                          type="submit"
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground active:opacity-90"
                        >
                          <Repeat className="size-4" /> Maak actief
                        </button>
                      </form>
                    ) : state === "review" ? (
                      <p className="text-xs text-neutral-500">
                        Je coach beoordeelt dit schema; activeren kan zodra dat klaar is.
                      </p>
                    ) : null}

                    {/* Eenmalig trainen: een lopende training wordt hervat, dus
                        de knop verbergen zolang er een loopt. */}
                    {!running ? (
                      <form
                        action={startOneOffFromAssignment}
                        className="flex items-center gap-2 rounded-xl border border-border bg-surface-0 p-1.5"
                      >
                        <input type="hidden" name="assignmentId" value={s.id} />
                        {multiDay ? (
                          <select
                            name="dayId"
                            aria-label="Welke dag wil je eenmalig trainen?"
                            className="min-w-0 flex-1 rounded-lg border border-border bg-surface-0 px-2.5 py-2 text-sm text-neutral-900 outline-none focus:border-accent"
                            defaultValue={tpl.days[0]?.id}
                          >
                            {tpl.days.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="min-w-0 flex-1 px-2 text-xs text-neutral-500">
                            Zonder te wisselen
                          </span>
                        )}
                        <button
                          type="submit"
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-neutral-800 active:bg-surface-2"
                        >
                          <Play className="size-4 fill-current text-accent" /> Eenmalig trainen
                        </button>
                      </form>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canBuild ? (
        <Link
          href="/member/schema/templates"
          className="flex items-center justify-center gap-2 rounded-2xl border border-border px-6 py-3 text-center text-sm font-medium text-neutral-700 active:bg-surface-2"
        >
          <Layers className="size-4 text-accent" /> Kant-en-klare workout uit de catalogus
        </Link>
      ) : null}
    </div>
  );
}
