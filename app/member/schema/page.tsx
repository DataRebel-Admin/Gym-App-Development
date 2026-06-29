import { requireMember, getAssignedSchema } from "@/lib/member";
import {
  SchemaChecklist,
  type ChecklistItem,
  type ChecklistDay,
} from "./schema-checklist";
import { startSession } from "./actions";

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

export default async function MemberSchemaPage() {
  const member = await requireMember();
  const assignment = await getAssignedSchema(member.id, member.tenantId);
  const schema = assignment?.template;

  if (!schema) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-lg font-medium text-neutral-900">Nog geen schema</p>
        <p className="text-sm text-neutral-500">
          Je trainer heeft je nog geen schema toegewezen.
        </p>
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
    <div className="flex flex-1 flex-col gap-5 px-5 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          {schema.name}
        </h1>
        {schema.description ? (
          <p className="mt-1 text-sm text-neutral-500">{schema.description}</p>
        ) : null}
      </div>

      {multiDay ? (
        <SchemaChecklist days={days} />
      ) : (
        <SchemaChecklist items={flatItems} />
      )}

      <form action={startSession}>
        <button
          type="submit"
          className="mt-2 w-full rounded-2xl bg-accent px-6 py-5 text-center text-lg font-semibold text-accent-foreground active:opacity-90"
        >
          Start training
        </button>
      </form>

      <a
        href="/member/schema/pdf"
        className="rounded-2xl border border-neutral-200 px-6 py-3 text-center text-sm font-medium text-neutral-700 active:bg-neutral-50"
      >
        ⬇ Download als PDF
      </a>
    </div>
  );
}
