import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/member";
import { prisma } from "@/lib/db";
import {
  requireMemberSchemaEnabled,
  requireAssignedEditEnabled,
  getMemberSchemaForEdit,
  getMemberExercises,
  resolveFramework,
} from "@/lib/member-schema";
import { isEditableMemberStatus, requiresApproval } from "@/lib/member-schema-status";
import { itemToInputValues } from "@/lib/exercise-params";
import { pickGroupFields } from "@/lib/exercise-groups";
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

  const assignment = await getMemberSchemaForEdit(id, member.id, member.tenantId);
  if (!assignment?.template) redirect("/member/schema/builder");

  // Twee herkomsten, twee poorten: een zelf-gebouwd schema valt onder
  // `memberSchemaMode`, een toegewezen schema onder `memberCanEditAssigned`.
  const assigned = assignment.origin === "COACH";
  if (assigned) await requireAssignedEditEnabled(member.tenantId);
  const mode = assigned ? null : await requireMemberSchemaEnabled(member.tenantId);

  const memberStatus = assignment.memberStatus ?? "DRAFT";
  // Alles behalve "in beoordeling" is bewerkbaar — ook een actief schema. Ligt het
  // bij de coach, dan moet het lid eerst intrekken (knop op het overzicht). Een
  // toegewezen schema kent die levenscyclus niet.
  if (!assigned && !isEditableMemberStatus(memberStatus)) redirect("/member/schema/builder");

  const [exercises, framework, userRow] = await Promise.all([
    getMemberExercises(member.tenantId),
    // Kaders begrenzen zelf-bouwen; op het schema van de trainer is de coach
    // leidend (zie persistDraft) — dus ook geen kader-chips of gefilterde picker.
    assigned ? null : resolveFramework(member.tenantId, member.id),
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
      memberNote: it.memberNote ?? "",
      ...pickGroupFields(it),
    })),
  }));

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 px-5 pt-5">
        <Link
          href={assigned ? "/member/schema" : "/member/schema/builder"}
          className="inline-flex items-center gap-1 text-sm text-neutral-500 active:text-neutral-900"
        >
          <ChevronLeft className="size-4" />
          {assigned ? "Mijn schema" : "Mijn schema's"}
        </Link>
      </div>
      <MemberSchemaEditor
        assignmentId={assignment.id}
        kind={assigned ? "assigned" : "own"}
        status={memberStatus}
        isLive={assignment.status === "PUBLISHED"}
        // Kader-override kan de tenant-modus overrulen — dezelfde regel als de
        // server-action, zodat de knoptekst nooit iets anders belooft.
        needsApproval={mode != null && requiresApproval(mode, framework?.requireApproval)}
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
