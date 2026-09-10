import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/member";
import { prisma } from "@/lib/db";
import { requireMemberSchemaEnabled, getMemberSchemas } from "@/lib/member-schema";
import { isEditableMemberStatus } from "@/lib/member-schema-status";
import { getCatalogDetail } from "@/lib/member-catalog";
import {
  CATALOG_LEVEL_LABELS,
  catalogStartSource,
  parseCatalogSource,
} from "@/lib/member-catalog-core";
import { hasGoalOverlap, parseTrainingGoals } from "@/lib/training-goals";
import { getCurrentTenant } from "@/lib/tenant";
import { Badge } from "@/components/ui/badge";
import { SchemaBadges } from "@/components/schema/schema-badges";
import { SchemaCover } from "@/components/schema/schema-cover";
import { ChevronLeft, Clock, Play, Plus } from "@/components/ui/icons";
import {
  startMemberSchema,
  addDayFromTemplate,
  startOneOffWorkout,
} from "../../../builder/actions";

export const metadata = { title: "Template" };

export default async function MemberTemplateDetailPage({
  params,
}: {
  params: Promise<{ source: string; id: string }>;
}) {
  const member = await requireMember();
  await requireMemberSchemaEnabled(member.tenantId);

  const { source: rawSource, id: rawId } = await params;
  const source = parseCatalogSource(rawSource);
  if (!source) notFound();
  const id = decodeURIComponent(rawId);

  const [tenant, user] = await Promise.all([
    getCurrentTenant(),
    prisma.user.findUnique({ where: { id: member.id }, select: { trainingGoals: true } }),
  ]);
  const detail = await getCatalogDetail(source, id, member.tenantId, {
    logoUrl: tenant?.logoUrl ?? null,
  });
  if (!detail) notFound();
  const { row, days, newExerciseCount } = detail;

  const memberGoals = parseTrainingGoals(user?.trainingGoals);
  const matched = hasGoalOverlap(row.goals, memberGoals);

  // Doel-schema's voor "dag toevoegen": eigen, nu bewerkbare schema's.
  const targets =
    row.type === "day"
      ? (await getMemberSchemas(member.id, member.tenantId)).filter((s) =>
          isEditableMemberStatus(s.memberStatus ?? "DRAFT")
        )
      : [];

  const metaParts = [
    row.type === "week"
      ? `${row.dayCount} ${row.dayCount === 1 ? "trainingsdag" : "trainingsdagen"}`
      : "losse trainingsdag",
    `${row.exerciseCount} oefeningen`,
    row.minutes ? `±${row.minutes} min` : null,
    row.daysPerWeek ? `aanbevolen ${row.daysPerWeek}× per week` : null,
    row.level ? CATALOG_LEVEL_LABELS[row.level] : null,
    row.validityWeeks ? `${row.validityWeeks} weken geldig` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-1 flex-col gap-5 px-5 py-6 pb-28">
      <div className="flex items-center gap-2">
        <Link
          href="/member/schema/templates"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 active:text-neutral-900"
        >
          <ChevronLeft className="size-4" /> Catalogus
        </Link>
      </div>

      <SchemaCover image={row.image} alt={row.name} className="rounded-2xl" priority />

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
            {row.name}
          </h1>
          {matched ? <Badge tone="accent">Past bij jouw doel</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-neutral-500">{metaParts.join(" · ")}</p>
        <div className="mt-2">
          <SchemaBadges badges={row.badges} />
        </div>
        {row.description ? (
          <p className="mt-3 text-sm text-neutral-700">{row.description}</p>
        ) : null}
      </div>

      {newExerciseCount > 0 ? (
        <div className="rounded-2xl border border-border bg-surface-1 px-4 py-3 text-sm text-neutral-600">
          Dit template voegt <span className="font-semibold text-neutral-900">{newExerciseCount}</span>{" "}
          {newExerciseCount === 1 ? "oefening" : "oefeningen"} toe die nieuw{" "}
          {newExerciseCount === 1 ? "is" : "zijn"} voor jouw sportschool. Niet elke oefening
          staat mogelijk op apparatuur die er is; je kunt oefeningen daarna gewoon vervangen.
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {days.map((day, i) => (
          <section key={i} className="rounded-2xl border border-border bg-surface-1 p-4">
            {row.type === "week" ? (
              <h2 className="mb-3 text-sm font-bold text-neutral-900">
                {day.name}
                <span className="ml-2 font-normal text-neutral-400">
                  {day.items.length} oefeningen
                </span>
              </h2>
            ) : null}
            <ul className="flex flex-col gap-3">
              {day.items.map((item, j) => (
                <li key={j} className="flex items-center gap-3">
                  {item.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbUrl}
                      alt=""
                      loading="lazy"
                      className="size-12 shrink-0 rounded-lg bg-surface-2 object-contain"
                    />
                  ) : (
                    <span className="size-12 shrink-0 rounded-lg bg-surface-2" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-neutral-900">
                        {item.name}
                      </span>
                      {!item.inGym ? (
                        <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700">
                          nieuw
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      {[
                        item.sets && item.reps ? `${item.sets} × ${item.reps}` : null,
                        item.restSeconds ? `rust ${item.restSeconds}s` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {item.notes ? (
                      <span className="block text-xs text-neutral-400">{item.notes}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Acties */}
      <div className="sticky bottom-[calc(5rem_+_env(safe-area-inset-bottom))] flex flex-col gap-2">
        <form action={startMemberSchema}>
          <input type="hidden" name="source" value={catalogStartSource(row)} />
          <button
            type="submit"
            className="w-full rounded-2xl bg-accent-gradient px-6 py-4 text-center text-base font-bold text-accent-foreground shadow-accent active:scale-[0.98]"
          >
            {row.type === "week" ? "Gebruik dit schema" : "Start als los schema"}
          </button>
        </form>

        {/* Eenmalig: meteen trainen zonder je actieve schema te wijzigen. Bij een
            weekschema kies je welke dag; de kopie blijft verborgen (geen
            toewijzing) en verdwijnt weer als je de training annuleert. */}
        <form
          action={startOneOffWorkout}
          className="flex items-center gap-2 rounded-2xl border border-border bg-surface-1 p-2"
        >
          <input type="hidden" name="source" value={catalogStartSource(row)} />
          {days.length > 1 ? (
            <select
              name="day"
              aria-label="Welke dag wil je eenmalig doen?"
              className="min-w-0 flex-1 rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-accent"
              defaultValue="0"
            >
              {days.map((d, i) => (
                <option key={i} value={i}>
                  {d.name} · {d.items.length} oef.
                </option>
              ))}
            </select>
          ) : (
            <span className="min-w-0 flex-1 px-2 text-sm text-neutral-600">
              Zonder je schema te wijzigen
            </span>
          )}
          <button
            type="submit"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground active:opacity-90"
          >
            <Play className="size-4 fill-current" /> Eenmalig doen
          </button>
        </form>

        {row.type === "day" && targets.length > 0 ? (
          <form
            action={addDayFromTemplate}
            className="flex items-center gap-2 rounded-2xl border border-border bg-surface-1 p-2"
          >
            <input type="hidden" name="ref" value={`${row.source}:${row.id}`} />
            <select
              name="assignmentId"
              className="min-w-0 flex-1 rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-accent"
              defaultValue={targets[0]?.id}
            >
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.template?.name ?? "Naamloos schema"}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground active:opacity-90"
            >
              <Plus className="size-4" /> Dag toevoegen
            </button>
          </form>
        ) : null}
      </div>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-neutral-400">
        <Clock className="size-3.5" /> Je krijgt een eigen, bewerkbare kopie; het template
        zelf verandert niet mee.
      </p>
    </div>
  );
}
