import Link from "next/link";
import { requireMember } from "@/lib/member";
import {
  requireMemberSchemaEnabled,
  getMemberVisibleTemplates,
} from "@/lib/member-schema";
import { SCHEMA_BLUEPRINTS } from "@/lib/member-schema-blueprints";
import { GOAL_OPTIONS, REQUEST_GOAL_LABELS } from "@/lib/schema-requests";
import { ChevronLeft } from "@/components/ui/icons";
import { SchemaBadges } from "@/components/schema/schema-badges";
import { startMemberSchema } from "../actions";

export const metadata = { title: "Nieuw schema" };

const field =
  "w-full rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-accent";

export default async function MemberBuilderNewPage() {
  const member = await requireMember();
  await requireMemberSchemaEnabled(member.tenantId);

  const templates = await getMemberVisibleTemplates(member.tenantId);

  return (
    <div className="flex flex-1 flex-col gap-6 px-5 py-6">
      <div className="flex items-center gap-2">
        <Link
          href="/member/schema/builder"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 active:text-neutral-900"
        >
          <ChevronLeft className="size-4" /> Terug
        </Link>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          Waar wil je mee beginnen?
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Kies een startpunt en je doel. Je kunt daarna alles zelf aanpassen.
        </p>
      </div>

      <form action={startMemberSchema} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Mijn doel <span className="font-normal text-neutral-400">(optioneel)</span>
          <select name="goal" defaultValue="" className={field}>
            <option value="">Kies een doel…</option>
            {GOAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {REQUEST_GOAL_LABELS[o.value]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Focus <span className="font-normal text-neutral-400">(optioneel)</span>
          <input
            name="focusNote"
            maxLength={500}
            placeholder="bv. meer kracht in mijn benen"
            className={field}
          />
        </label>

        {templates.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-neutral-900">Sjablonen van je sportschool</p>
            {templates.map((tpl) => (
              <label
                key={tpl.id}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface-1 px-4 py-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
              >
                <input
                  type="radio"
                  name="source"
                  value={`template:${tpl.id}`}
                  className="mt-1 accent-[var(--tenant-accent)]"
                />
                <span className="min-w-0">
                  <span className="block font-semibold text-neutral-900">{tpl.name}</span>
                  <span className="block text-xs text-neutral-500">
                    {tpl._count.days} dagen · {tpl._count.items} oefeningen
                    {tpl.description ? ` · ${tpl.description}` : ""}
                  </span>
                  <span className="mt-1.5 block">
                    <SchemaBadges badges={tpl.badges} size="xs" max={3} />
                  </span>
                </span>
              </label>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-neutral-900">Blueprints</p>
          {SCHEMA_BLUEPRINTS.map((bp, i) => {
            const Icon = bp.icon;
            return (
              <label
                key={bp.key}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface-1 px-4 py-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
              >
                <input
                  type="radio"
                  name="source"
                  value={`blueprint:${bp.key}`}
                  defaultChecked={i === 0}
                  className="mt-1 accent-[var(--tenant-accent)]"
                />
                <span className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-accent">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-neutral-900">{bp.label}</span>
                    <span className="block text-xs text-neutral-500">{bp.description}</span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <button
          type="submit"
          className="sticky bottom-20 rounded-2xl bg-accent-gradient px-6 py-4 text-center text-base font-bold text-accent-foreground shadow-accent active:scale-[0.98]"
        >
          Beginnen
        </button>
      </form>
    </div>
  );
}
