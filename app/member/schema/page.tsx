import Link from "next/link";
import { requireMember, getAssignedSchema } from "@/lib/member";
import { SchemaChecklist, type ChecklistItem } from "./schema-checklist";

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

  const items: ChecklistItem[] = schema.items.map((it) => ({
    id: it.id,
    exerciseName: it.exercise.name,
    machineName: it.exercise.machine?.name ?? null,
    sets: it.sets,
    reps: it.reps,
    restSeconds: it.restSeconds,
  }));

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

      <SchemaChecklist items={items} />

      <Link
        href="/member/schema/active"
        className="mt-2 rounded-2xl bg-accent px-6 py-5 text-center text-lg font-semibold text-accent-foreground active:opacity-90"
      >
        Start training
      </Link>
    </div>
  );
}
