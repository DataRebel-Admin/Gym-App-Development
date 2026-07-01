import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/member";
import { prisma } from "@/lib/db";
import {
  requireMemberSchemaEnabled,
  getMemberSchemaForEdit,
  getMemberExercises,
  resolveFramework,
} from "@/lib/member-schema";
import { isEditableMemberStatus } from "@/lib/member-schema-status";
import { itemToInputValues } from "@/lib/exercise-params";
import { getFavoriteIds } from "@/lib/user-preferences";
import { MemberSchemaEditor } from "@/components/member/member-schema-editor";
import type { EditorDay } from "@/components/schema-editor";
import { ChevronLeft } from "@/components/ui/icons";

export const metadata = { title: "Schema samenstellen" };

export default async function MemberSchemaBuilderEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const member = await requireMember();
  const mode = await requireMemberSchemaEnabled(member.tenantId);

  const assignment = await getMemberSchemaForEdit(id, member.id, member.tenantId);
  if (!assignment?.template) redirect("/member/schema/builder");
  const memberStatus = assignment.memberStatus ?? "DRAFT";
  // Alleen concept/afgewezen zijn bewerkbaar; anders terug naar het overzicht.
  if (!isEditableMemberStatus(memberStatus)) redirect("/member/schema/builder");

  const [exercises, framework, userRow] = await Promise.all([
    getMemberExercises(member.tenantId),
    resolveFramework(member.tenantId, member.id),
    prisma.user.findUnique({ where: { id: member.id }, select: { preferences: true } }),
  ]);

  const favorites = getFavoriteIds(userRow?.preferences);

  const initialDays: EditorDay[] = assignment.template.days.map((d) => ({
    key: d.id,
    name: d.name,
    notes: d.notes ?? "",
    items: d.items.map((it) => ({
      key: it.id,
      exerciseId: it.exerciseId,
      exerciseName: it.exercise.name,
      exerciseType: it.exercise.exerciseType,
      values: itemToInputValues(it, it.exercise.exerciseType),
      notes: it.notes ?? "",
    })),
  }));

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 px-5 pt-5">
        <Link
          href="/member/schema/builder"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 active:text-neutral-900"
        >
          <ChevronLeft className="size-4" /> Mijn schema&apos;s
        </Link>
      </div>
      <MemberSchemaEditor
        assignmentId={assignment.id}
        status={memberStatus}
        mode={mode}
        initialName={assignment.template.name}
        initialDescription={assignment.template.description ?? ""}
        initialDays={initialDays}
        availableExercises={exercises}
        limits={framework?.limits ?? null}
        initialFavorites={favorites}
        reviewNote={assignment.reviewNote}
      />
    </div>
  );
}
