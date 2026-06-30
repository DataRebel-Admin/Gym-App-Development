import Link from "next/link";
import { requireMember, getAssignedSchema } from "@/lib/member";
import { Fullscreenable, FullscreenButton } from "@/components/ui/fullscreen";
import { EmptyState } from "@/components/ui/empty-state";
import { Dumbbell, Play, Download, CalendarDays, QrCode } from "@/components/ui/icons";
import {
  SchemaChecklist,
  type ChecklistItem,
  type ChecklistDay,
} from "./schema-checklist";
import { startSession } from "./actions";
import { MarkSchemaSeen } from "@/components/member/mark-schema-seen";

type ItemWithRel = {
  id: string;
  sets: number;
  reps: number;
  restSeconds: number;
  exercise: {
    name: string;
    machine: { name: string } | null;
    catalog: { imageUrl: string | null; gifUrl: string | null } | null;
  };
};

function toChecklistItem(it: ItemWithRel): ChecklistItem {
  return {
    id: it.id,
    exerciseName: it.exercise.name,
    machineName: it.exercise.machine?.name ?? null,
    sets: it.sets,
    reps: it.reps,
    restSeconds: it.restSeconds,
    thumbUrl: it.exercise.catalog?.imageUrl ?? it.exercise.catalog?.gifUrl ?? null,
  };
}

export const metadata = { title: "Mijn schema" };

export default async function MemberSchemaPage() {
  const member = await requireMember();
  const assignment = await getAssignedSchema(member.id, member.tenantId);
  const schema = assignment?.template;
  const isNew = assignment ? assignment.seenAt === null : false;
  const trainerMessage = assignment?.trainerMessage?.trim() || null;

  if (!schema) {
    return (
      <div className="flex flex-1 flex-col justify-center px-5 py-10">
        <EmptyState
          icon={<Dumbbell className="size-8 text-accent" />}
          title="Nog geen trainingsschema"
          description="Je trainer stelt een schema voor je samen. Zodra het klaarstaat, vind je het hier — klaar om af te vinken. Verken intussen de apparaten in je sportschool."
          action={
            <Link
              href="/member/scan"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground active:opacity-90"
            >
              <QrCode className="size-4" /> Scan een machine
            </Link>
          }
        />
      </div>
    );
  }

  // Toon per dag wanneer er dagen zijn; anders één platte lijst.
  const days: ChecklistDay[] = schema.days.map((d) => ({
    name: d.name,
    items: d.items.map(toChecklistItem),
  }));
  const flatItems: ChecklistItem[] = schema.items.map(toChecklistItem);
  const multiDay = days.length > 1;

  return (
    <Fullscreenable className="flex flex-1 flex-col gap-5 px-5 py-8">
      {isNew ? <MarkSchemaSeen /> : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
              {schema.name}
            </h1>
            {isNew ? (
              <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-accent-foreground">
                Nieuw
              </span>
            ) : null}
          </div>
          {schema.description ? (
            <p className="mt-1 text-sm text-neutral-500">{schema.description}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-neutral-600">
              <Dumbbell className="size-3.5 text-accent" /> {schema.items.length} oefeningen
            </span>
            {multiDay ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-neutral-600">
                <CalendarDays className="size-3.5 text-accent" /> {days.length} dagen
              </span>
            ) : null}
          </div>
        </div>
        <FullscreenButton />
      </div>

      {trainerMessage ? (
        <div className="rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Bericht van je trainer
          </p>
          <p className="mt-1 text-sm text-neutral-700">{trainerMessage}</p>
        </div>
      ) : null}

      {multiDay ? (
        <SchemaChecklist days={days} />
      ) : (
        <SchemaChecklist items={flatItems} />
      )}

      <form action={startSession}>
        <button
          type="submit"
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-gradient px-6 py-5 text-center text-lg font-bold text-accent-foreground shadow-accent transition-transform active:scale-[0.98]"
        >
          <Play className="size-5 fill-current" /> Start training
        </button>
      </form>

      <a
        href="/member/schema/pdf"
        className="flex items-center justify-center gap-2 rounded-2xl border border-border px-6 py-3 text-center text-sm font-medium text-neutral-700 active:bg-surface-2"
      >
        <Download className="size-4" /> Download als PDF
      </a>
    </Fullscreenable>
  );
}
