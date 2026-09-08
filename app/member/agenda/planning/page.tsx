import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireMember } from "@/lib/member";
import { requireFeature } from "@/lib/features/service";
import { getPlanEditorData } from "@/lib/calendar";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { ChevronLeft } from "@/components/ui/icons";
import { WeekdayPlanner } from "@/components/calendar/weekday-planner";

export async function generateMetadata() {
  const t = await getTranslations("member.agenda");
  return { title: t("plannerTitle") };
}

/** Subpagina van de agenda: trainingsdagen van het actieve schema aan weekdagen koppelen. */
export default async function AgendaPlanningPage() {
  const member = await requireMember();
  await requireFeature(member.tenantId, "calendar");
  const [planEditor, t] = await Promise.all([
    getPlanEditorData(member.id, member.tenantId),
    getTranslations("member.agenda"),
  ]);

  return (
    <Reveal stagger className="flex flex-1 flex-col gap-5 px-5 py-7">
      <RevealItem>
        <Link
          href="/member/agenda"
          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 active:text-neutral-700"
        >
          <ChevronLeft className="size-4" /> {t("backToAgenda")}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-neutral-900">
          {t("plannerTitle")}
        </h1>
        <p className="mt-1 text-neutral-500">{t("plannerDesc")}</p>
      </RevealItem>

      <RevealItem>
        {planEditor && planEditor.days.length > 0 ? (
          <WeekdayPlanner
            assignmentId={planEditor.assignmentId}
            days={planEditor.days}
            plan={planEditor.plan}
          />
        ) : (
          <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-neutral-500">
            {t("plannerNoSchema")}
          </p>
        )}
      </RevealItem>
    </Reveal>
  );
}
