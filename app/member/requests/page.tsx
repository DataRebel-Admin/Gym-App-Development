import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireMember, hasActiveCoachSchema } from "@/lib/member";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { SchemaRequestForm } from "@/components/schema-request-form";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { cancelRequest, deleteRequest } from "./actions";
import {
  REQUEST_STATUS_META,
  REQUEST_KIND_META,
  canCancelRequest,
  canDeleteRequest,
  canSubmitRequest,
  isOpenRequest,
  parseRequestKind,
  requestKindHref,
} from "@/lib/schema-requests";
import { fmtDate } from "@/lib/schema-status";

/** Subtiele tekstknop in de kaartvoet — zelfde gewicht als de datum ernaast. */
const actionClass =
  "shrink-0 text-neutral-500 underline-offset-2 hover:text-red-600 hover:underline";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const t = await getTranslations("member.requests");
  const kind = parseRequestKind((await searchParams).type);
  return { title: kind === "CHANGE" ? t("changeMetaTitle") : t("metaTitle") };
}

export default async function MemberRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const member = await requireMember();
  const t = await getTranslations("member.requests");
  const tr = await getTranslations("requests");

  // Aanpassing vragen kan alleen op een schema dat er is én van de coach komt:
  // een zelfgebouwd schema past het lid zelf aan. Ontbreekt dat, dan is de
  // nieuw-schema-aanvraag het enige zinvolle formulier (met korte uitleg).
  const wanted = parseRequestKind((await searchParams).type);
  const coachSchema = await hasActiveCoachSchema(member.id, member.tenantId);
  const kind = wanted === "CHANGE" && coachSchema ? "CHANGE" : "NEW_SCHEMA";
  const fellBack = wanted === "CHANGE" && !coachSchema;

  const requests = await prisma.schemaRequest.findMany({
    where: { tenantId: member.tenantId, userId: member.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      kind: true,
      goal: true,
      description: true,
      preferredStart: true,
      status: true,
      createdAt: true,
    },
  });

  // Openstaand per type — een aanpassingsverzoek blokkeert geen nieuw schema.
  const openKinds = requests.filter((r) => isOpenRequest(r.status)).map((r) => r.kind);
  const canSubmit = canSubmitRequest(kind, openKinds);
  const isChange = kind === "CHANGE";

  return (
    <div className="flex flex-1 flex-col gap-6 px-5 py-7">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          {isChange ? t("changeTitle") : t("title")}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {isChange ? t("changeSubtitle") : t("subtitle")}
        </p>
      </div>

      {fellBack ? (
        <p className="rounded-2xl border border-border bg-surface-1 px-4 py-3 text-sm text-neutral-600">
          {t("changeNoSchema")}
        </p>
      ) : null}

      <SchemaRequestForm kind={kind} canSubmit={canSubmit} />

      {/* Verkeerd formulier? Eén tik naar het andere type. De aanpassing-variant
          bieden we alleen aan als er ook echt een coach-schema ligt. */}
      {isChange ? (
        <Link
          href={requestKindHref("NEW_SCHEMA")}
          className="text-sm font-medium text-accent underline-offset-2 hover:underline"
        >
          {t("switchToNew")}
        </Link>
      ) : coachSchema ? (
        <Link
          href={requestKindHref("CHANGE")}
          className="text-sm font-medium text-accent underline-offset-2 hover:underline"
        >
          {t("switchToChange")}
        </Link>
      ) : null}

      {requests.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-neutral-900">{t("myRequests")}</h2>
          <ul className="flex flex-col gap-2">
            {requests.map((r) => {
              const meta = REQUEST_STATUS_META[r.status];
              const kindMeta = REQUEST_KIND_META[r.kind];
              return (
                <li
                  key={r.id}
                  className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-1 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-neutral-900">
                      {r.goal ? tr(`goal${r.goal}`) : tr(`kind${r.kind}`)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Badge tone={kindMeta.tone}>{tr(`kind${r.kind}`)}</Badge>
                      <Badge tone={meta.tone}>{tr(`status${r.status}`)}</Badge>
                    </span>
                  </div>
                  {r.description ? (
                    <p className="text-sm text-neutral-600">{r.description}</p>
                  ) : null}
                  <div className="flex items-center justify-between gap-2 text-xs text-neutral-400">
                    <span>
                      {t("requestedOn", { date: fmtDate(r.createdAt) })}
                      {r.preferredStart ? t("startOn", { date: fmtDate(r.preferredStart) }) : ""}
                    </span>
                    {/* Lopend → intrekken; afgesloten → opruimen. Beide gelden voor
                        élk aanvraagtype en vragen eerst om bevestiging. */}
                    {canCancelRequest(r.status) ? (
                      <ConfirmButton
                        action={cancelRequest}
                        fields={{ id: r.id }}
                        label={t("withdraw")}
                        title={t("withdrawTitle")}
                        message={t("withdrawBody")}
                        confirmLabel={t("withdraw")}
                        confirmVariant="danger"
                        triggerClassName={actionClass}
                      />
                    ) : canDeleteRequest(r.status) ? (
                      <ConfirmButton
                        action={deleteRequest}
                        fields={{ id: r.id }}
                        label={t("delete")}
                        title={t("deleteTitle")}
                        message={t("deleteBody")}
                        confirmLabel={t("delete")}
                        triggerClassName={actionClass}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
