import { getTranslations } from "next-intl/server";
import { requireMember } from "@/lib/member";
import { requireFeature } from "@/lib/features/service";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { DEFECT_STATUS_META, DEFECT_SEVERITY_META } from "@/lib/defects";
import { fmtDate } from "@/lib/schema-status";
import { ReportDefectButton } from "@/components/defects/report-defect-modal";

export async function generateMetadata() {
  const t = await getTranslations("defects");
  return { title: t("metaTitle") };
}

/**
 * Eigen defectmeldingen van het lid + de algemene meldknop (apparaat zelf
 * kiezen). Anonieme meldingen hebben geen reportedById en verschijnen hier
 * bewust niet — dat is precies de afspraak van anoniem melden.
 */
export default async function MemberDefectsPage() {
  const member = await requireMember();
  await requireFeature(member.tenantId, "defects");
  const t = await getTranslations("defects");

  const reports = await prisma.equipmentDefect.findMany({
    where: { tenantId: member.tenantId, reportedById: member.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      machineLabel: true,
      symptom: true,
      status: true,
      severity: true,
      createdAt: true,
      resolvedAt: true,
      resolutionNote: true,
    },
  });

  return (
    <div className="flex flex-1 flex-col gap-6 px-5 py-7">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          {t("list.title")}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">{t("list.subtitle")}</p>
      </div>

      <ReportDefectButton variant="primary" />

      {reports.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-neutral-900">{t("list.mine")}</h2>
          <ul className="flex flex-col gap-2">
            {reports.map((r) => {
              const statusMeta = DEFECT_STATUS_META[r.status];
              const sevMeta = DEFECT_SEVERITY_META[r.severity];
              return (
                <li
                  key={r.id}
                  className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-1 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium text-neutral-900">
                      {r.machineLabel ?? t("list.unknownMachine")}
                    </span>
                    <Badge tone={statusMeta.tone}>{t(`status.${r.status}`)}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
                    <span>{t(`symptoms.${r.symptom}`)}</span>
                    {r.severity !== "MINOR" ? (
                      <Badge tone={sevMeta.tone}>{t(`severity.${r.severity}`)}</Badge>
                    ) : null}
                    <span className="ml-auto text-xs text-neutral-400">
                      {fmtDate(r.createdAt)}
                    </span>
                  </div>
                  {r.status === "RESOLVED" && r.resolutionNote ? (
                    <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-neutral-600">
                      {r.resolutionNote}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="rounded-2xl border border-border bg-surface-1 px-4 py-5 text-center text-sm text-neutral-500">
          {t("list.empty")}
        </p>
      )}
    </div>
  );
}
