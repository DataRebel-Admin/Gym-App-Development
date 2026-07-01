import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireMember } from "@/lib/member";
import { getMuscleAnalysis } from "@/lib/muscle-analysis";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { EmptyState } from "@/components/ui/empty-state";
import { BodyHeatmap } from "@/components/muscle/body-heatmap";
import { MuscleRadar } from "@/components/muscle/muscle-radar";
import { PersonStanding, Activity, ClipboardList } from "@/components/ui/icons";

export async function generateMetadata() {
  const t = await getTranslations("member.muscles");
  return { title: t("metaTitle") };
}

export default async function MemberMusclesPage() {
  const member = await requireMember();
  const [analysis, t] = await Promise.all([
    getMuscleAnalysis(member.id, member.tenantId),
    getTranslations("member.muscles"),
  ]);

  return (
    <Reveal stagger className="flex flex-col gap-5 px-4 py-6">
      <RevealItem>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">{t("subtitle")}</p>
      </RevealItem>

      {!analysis.hasSchema ? (
        <RevealItem>
          <EmptyState
            icon={<PersonStanding className="size-7 text-accent" />}
            title={t("emptyTitle")}
            description={t("emptyDesc")}
            action={
              <Link
                href="/member/requests"
                className="inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm active:scale-[0.98]"
              >
                <ClipboardList className="size-4" /> {t("requestSchema")}
              </Link>
            }
          />
        </RevealItem>
      ) : (
        <>
          {/* Heatmap */}
          <RevealItem className="rounded-3xl border border-border bg-surface-1 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <PersonStanding className="size-5 text-accent" />
              <p className="font-display text-lg font-bold text-neutral-900">
                {t("heatmapTitle")}
              </p>
            </div>
            <p className="-mt-2 mb-3 text-sm text-neutral-500">
              {t.rich("heatmapIntro", {
                schema: analysis.schemaName ?? "",
                b: (chunks) => (
                  <span className="font-semibold text-neutral-700">{chunks}</span>
                ),
              })}
            </p>
            <BodyHeatmap regions={analysis.regions} />
          </RevealItem>

          {/* Vergelijking */}
          <RevealItem className="rounded-3xl border border-border bg-surface-1 p-5 shadow-sm">
            <div className="mb-1 flex items-center gap-2">
              <Activity className="size-5 text-accent" />
              <p className="font-display text-lg font-bold text-neutral-900">
                {t("compareTitle")}
              </p>
            </div>
            <p className="mb-3 text-sm text-neutral-500">{t("compareIntro")}</p>
            {analysis.hasActual ? (
              <MuscleRadar regions={analysis.regions} />
            ) : (
              <p className="py-8 text-center text-sm text-neutral-500">
                {t("noActual")}
              </p>
            )}
          </RevealItem>

          {/* Inzichten */}
          {(analysis.topRegions.length > 0 || analysis.neglected.length > 0) && (
            <RevealItem className="rounded-3xl border border-border bg-surface-1 p-5 shadow-sm">
              <p className="mb-3 font-display text-lg font-bold text-neutral-900">
                {t("balanceTitle")}
              </p>
              {analysis.topRegions.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
                    {t("mostTrained")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.topRegions.map((r) => (
                      <span
                        key={r.region}
                        className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent"
                      >
                        {t(`regions.${r.region}`)}
                        <span className="tabular-nums opacity-70">
                          {formatSets(r.planWeekly)}×
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {analysis.neglected.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
                    {t("notInSchema")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.neglected.map((r) => (
                      <span
                        key={r.region}
                        className="inline-flex items-center rounded-full bg-surface-2 px-3 py-1 text-sm font-medium text-neutral-500"
                      >
                        {t(`regions.${r.region}`)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </RevealItem>
          )}

          <RevealItem>
            <p className="px-2 text-center text-xs text-neutral-400">
              {t("disclaimer")}
            </p>
          </RevealItem>
        </>
      )}
    </Reveal>
  );
}

function formatSets(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
