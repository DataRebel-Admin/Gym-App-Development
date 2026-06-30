import { getTranslations } from "next-intl/server";
import { requireMember } from "@/lib/member";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { SchemaRequestForm } from "@/components/schema-request-form";
import { cancelRequest } from "./actions";
import {
  REQUEST_GOAL_LABELS,
  REQUEST_STATUS_META,
  isOpenRequest,
} from "@/lib/schema-requests";
import { fmtDate } from "@/lib/schema-status";

export async function generateMetadata() {
  const t = await getTranslations("member.requests");
  return { title: t("metaTitle") };
}

export default async function MemberRequestsPage() {
  const member = await requireMember();
  const t = await getTranslations("member.requests");

  const requests = await prisma.schemaRequest.findMany({
    where: { tenantId: member.tenantId, userId: member.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      goal: true,
      description: true,
      preferredStart: true,
      status: true,
      createdAt: true,
    },
  });

  const hasOpen = requests.some((r) => isOpenRequest(r.status));

  return (
    <div className="flex flex-1 flex-col gap-6 px-5 py-7">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {t("subtitle")}
        </p>
      </div>

      <SchemaRequestForm canSubmit={!hasOpen} />

      {requests.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-neutral-900">{t("myRequests")}</h2>
          <ul className="flex flex-col gap-2">
            {requests.map((r) => {
              const meta = REQUEST_STATUS_META[r.status];
              return (
                <li
                  key={r.id}
                  className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-1 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-neutral-900">
                      {REQUEST_GOAL_LABELS[r.goal]}
                    </span>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                  {r.description ? (
                    <p className="text-sm text-neutral-600">{r.description}</p>
                  ) : null}
                  <div className="flex items-center justify-between gap-2 text-xs text-neutral-400">
                    <span>
                      {t("requestedOn", { date: fmtDate(r.createdAt) })}
                      {r.preferredStart ? t("startOn", { date: fmtDate(r.preferredStart) }) : ""}
                    </span>
                    {(r.status === "NEW" || r.status === "IN_PROGRESS") ? (
                      <form action={cancelRequest}>
                        <input type="hidden" name="id" value={r.id} />
                        <button
                          type="submit"
                          className="text-neutral-500 underline-offset-2 hover:text-red-600 hover:underline"
                        >
                          {t("cancel")}
                        </button>
                      </form>
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
