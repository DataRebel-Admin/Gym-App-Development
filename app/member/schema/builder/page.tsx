import Link from "next/link";
import { requireMember } from "@/lib/member";
import { requireMemberSchemaEnabled, getMemberSchemas, resolveFramework } from "@/lib/member-schema";
import {
  MEMBER_STATUS_META,
  isEditableMemberStatus,
  isWithdrawableMemberStatus,
  hasUnsubmittedChanges,
  requiresApproval,
} from "@/lib/member-schema-status";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Dumbbell, Plus, Pencil, Play } from "@/components/ui/icons";
import { fmtDate } from "@/lib/schema-status";
import {
  activateMemberSchema,
  pauseMemberSchema,
  deleteMemberSchema,
  withdrawMemberSchema,
} from "./actions";

export const metadata = { title: "Mijn schema's" };

export default async function MemberBuilderOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; revision?: string }>;
}) {
  const member = await requireMember();
  const mode = await requireMemberSchemaEnabled(member.tenantId);
  const { submitted, revision } = await searchParams;

  const [schemas, framework] = await Promise.all([
    getMemberSchemas(member.id, member.tenantId),
    resolveFramework(member.tenantId, member.id),
  ]);
  const needsApproval = requiresApproval(mode, framework?.requireApproval);

  return (
    <div className="flex flex-1 flex-col gap-6 px-5 py-7">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          Mijn schema&apos;s
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Stel zelf een trainingsschema samen dat bij jouw doel past.
        </p>
      </div>

      {submitted ? (
        <div className="rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3">
          <p className="text-sm font-semibold text-neutral-900">
            {revision ? "Wijzigingen ingediend 🎉" : "Ingediend ter controle 🎉"}
          </p>
          <p className="mt-0.5 text-sm text-neutral-600">
            {revision
              ? "Je coach bekijkt je aanpassingen. Je kunt gewoon blijven trainen."
              : "Je coach bekijkt je schema en laat het je weten."}
          </p>
        </div>
      ) : null}

      <Link
        href="/member/schema/builder/new"
        className="flex items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3.5 text-sm font-bold text-accent-foreground active:opacity-90"
      >
        <Plus className="size-4" /> Nieuw schema samenstellen
      </Link>

      {schemas.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="size-8 text-accent" />}
          title="Nog geen eigen schema's"
          description="Begin met een blueprint of een leeg schema en bouw helemaal zelf op."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {schemas.map((s) => {
            const status = s.memberStatus ?? "DRAFT";
            const meta = MEMBER_STATUS_META[status];
            const editable = isEditableMemberStatus(status);
            // Verwijderen blijft beperkt tot concept/afgewezen: een schema dat in
            // gebruik is (geweest) hoort bij de historie van het lid.
            const removable = status === "DRAFT" || status === "REJECTED";
            const live = s.status === "PUBLISHED";
            const pendingChanges = hasUnsubmittedChanges({
              status,
              needsApproval,
              contentUpdatedAt: s.template?.updatedAt ?? null,
              reviewedAt: s.reviewedAt,
            });
            return (
              <li
                key={s.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-1 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display font-bold text-neutral-900">
                      {s.template?.name ?? "Naamloos schema"}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {s.template?._count.days ?? 0} dagen · {s.template?._count.items ?? 0} oefeningen ·{" "}
                      {fmtDate(s.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    {/* Tijdens een herbeoordeling blijft een lopend schema
                        trainbaar — dat is niet af te lezen aan de lid-status. */}
                    {live && status !== "ACTIVE" ? (
                      <Badge tone="success">In gebruik</Badge>
                    ) : null}
                  </div>
                </div>

                {status === "REJECTED" && s.reviewNote ? (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                    {s.reviewNote}
                  </p>
                ) : (
                  <p className="text-xs text-neutral-500">{meta.description}</p>
                )}

                {pendingChanges ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Je hebt dit schema aangepast. Dien de wijzigingen in zodat je coach
                    meekijkt.
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  {editable ? (
                    <Link
                      href={`/member/schema/builder/${s.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground active:opacity-90"
                    >
                      <Pencil className="size-4" /> Bewerken
                    </Link>
                  ) : null}

                  {(status === "APPROVED" || status === "PAUSED") ? (
                    <form action={activateMemberSchema}>
                      <input type="hidden" name="assignmentId" value={s.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground active:opacity-90"
                      >
                        <Play className="size-4 fill-current" /> Activeren
                      </button>
                    </form>
                  ) : null}

                  {isWithdrawableMemberStatus(status) ? (
                    <ConfirmButton
                      action={withdrawMemberSchema}
                      fields={{ assignmentId: s.id }}
                      label="Intrekken & bewerken"
                      triggerClassName="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-neutral-700 active:bg-surface-2"
                      title="Indiening intrekken?"
                      message="Je coach stopt met beoordelen en je kunt weer verder bewerken. Dien het daarna opnieuw in."
                    />
                  ) : null}

                  {live ? (
                    <Link
                      href="/member/schema"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-neutral-700 active:bg-surface-2"
                    >
                      Bekijk schema
                    </Link>
                  ) : null}

                  {status === "ACTIVE" ? (
                    <form action={pauseMemberSchema}>
                      <input type="hidden" name="assignmentId" value={s.id} />
                      <button
                        type="submit"
                        className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-neutral-600 active:bg-surface-2"
                      >
                        Pauzeren
                      </button>
                    </form>
                  ) : null}

                  {removable ? (
                    <ConfirmButton
                      action={deleteMemberSchema}
                      fields={{ assignmentId: s.id }}
                      label="Verwijderen"
                      triggerClassName="rounded-xl px-4 py-2 text-sm font-medium text-neutral-500 active:text-red-600"
                      title="Schema verwijderen?"
                      message="Weet je zeker dat je dit concept wilt verwijderen? Dit kan niet ongedaan worden gemaakt."
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
