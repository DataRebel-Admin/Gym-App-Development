import Link from "next/link";
import { requireMember } from "@/lib/member";
import { prisma } from "@/lib/db";
import { requireMemberSchemaEnabled } from "@/lib/member-schema";
import { SCHEMA_BLUEPRINTS } from "@/lib/member-schema-blueprints";
import { GOAL_OPTIONS, REQUEST_GOAL_LABELS } from "@/lib/schema-requests";
import {
  hasGoalOverlap,
  parseTrainingGoals,
  preferredRequestGoal,
  sortByGoalMatch,
} from "@/lib/training-goals";
import { ChevronLeft, ChevronRight, Layers } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { startMemberSchema } from "../actions";

export const metadata = { title: "Nieuw schema" };

const field =
  "w-full rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-accent";

export default async function MemberBuilderNewPage() {
  const member = await requireMember();
  await requireMemberSchemaEnabled(member.tenantId);

  const user = await prisma.user.findUnique({
    where: { id: member.id },
    select: { trainingGoals: true },
  });

  // Personalisatie op de doelen uit /account/doelen: passende blueprints eerst
  // (stabiel, geen filter), en het best passende blueprint is daardoor meteen de
  // voorselectie. Zonder gekozen doelen verandert er niets.
  const memberGoals = parseTrainingGoals(user?.trainingGoals);
  const blueprints = sortByGoalMatch(SCHEMA_BLUEPRINTS, memberGoals, (b) => b.goals);
  const defaultGoal = preferredRequestGoal(memberGoals);

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
          Zelf een schema opbouwen
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Kies een dag-indeling en je doel. Je kunt daarna alles zelf aanpassen.
        </p>
        {memberGoals.length > 0 ? (
          <p className="mt-1 text-xs text-neutral-400">
            Gesorteerd op{" "}
            <Link href="/account/doelen" className="underline underline-offset-2">
              jouw doelen
            </Link>
            : wat bij je past staat bovenaan.
          </p>
        ) : null}
      </div>

      {/* Kant-en-klaar? De catalogus is de primaire ingang; dit is de
          zelf-opbouwen-route (lege dag-structuren). */}
      <Link
        href="/member/schema/templates"
        className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 active:opacity-90"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Layers className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-neutral-900">
            Liever een kant-en-klaar template?
          </span>
          <span className="block text-xs text-neutral-600">
            Complete schema&apos;s en losse dagen, mét oefeningen, sets en herhalingen.
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-neutral-400" />
      </Link>

      <form action={startMemberSchema} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Mijn doel <span className="font-normal text-neutral-400">(optioneel)</span>
          <select name="goal" defaultValue={defaultGoal ?? ""} className={field}>
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

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-neutral-900">Blueprints</p>
          {blueprints.map((bp, i) => {
            const Icon = bp.icon;
            const matched = hasGoalOverlap(bp.goals, memberGoals);
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
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-neutral-900">{bp.label}</span>
                      {matched ? <Badge tone="accent">Past bij jouw doel</Badge> : null}
                    </span>
                    <span className="block text-xs text-neutral-500">{bp.description}</span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <button
          type="submit"
          className="sticky bottom-[calc(5rem_+_env(safe-area-inset-bottom))] rounded-2xl bg-accent-gradient px-6 py-4 text-center text-base font-bold text-accent-foreground shadow-accent active:scale-[0.98]"
        >
          Beginnen
        </button>
      </form>
    </div>
  );
}
