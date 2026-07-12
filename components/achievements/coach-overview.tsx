import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { Trophy, Flame, Activity, Sparkles, Clock } from "@/components/ui/icons";
import { rarityMeta } from "@/lib/achievements/rarity";
import type { CoachEngagement } from "@/lib/achievements/coach";

const REL_FMT = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function MemberLink({ userId, name }: { userId: string; name: string }) {
  return (
    <Link href={`/owner/members/${userId}`} className="truncate font-medium text-neutral-900 hover:text-accent">
      {name}
    </Link>
  );
}

function Section({
  title,
  icon,
  empty,
  emptyLabel,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  empty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
        <span className="text-accent">{icon}</span>
        {title}
      </h2>
      {empty ? (
        <Card className="p-5 text-center text-sm text-neutral-500">{emptyLabel}</Card>
      ) : (
        children
      )}
    </section>
  );
}

/**
 * Coach-inzichten rond betrokkenheid: wie behaalde net een mijlpaal, wie is bijna,
 * langste streaks, meest actieve leden en wie al langer geen nieuwe mijlpaal haalde.
 */
export async function CoachOverview({ data }: { data: CoachEngagement }) {
  const t = await getTranslations("achievements.ui");
  const emptyLabel = t("coach.noData");
  return (
    <div className="flex flex-col gap-8">
      <Section title={t("coach.recentMilestones")} icon={<Trophy className="size-4" />} empty={data.recentMilestones.length === 0} emptyLabel={emptyLabel}>
        <div className="flex flex-col gap-2">
          {data.recentMilestones.map((m, i) => {
            const meta = rarityMeta(m.rarity);
            return (
              <Card key={`${m.userId}-${m.title}-${i}`} className="flex items-center gap-3 p-3">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", meta.gradient)}>
                  <Trophy className={cn("size-4", meta.onGradient)} />
                </span>
                <div className="min-w-0 flex-1">
                  <MemberLink userId={m.userId} name={m.name} />
                  <p className="truncate text-xs text-neutral-500">
                    {m.title} · <span className="font-medium">{m.rarityLabel}</span>
                  </p>
                </div>
                <span className="shrink-0 text-xs text-neutral-400">{REL_FMT.format(m.earnedAt)}</span>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section title={t("coach.nearAchievement")} icon={<Sparkles className="size-4" />} empty={data.nearAchievements.length === 0} emptyLabel={emptyLabel}>
        <div className="flex flex-col gap-2">
          {data.nearAchievements.map((n, i) => (
            <Card key={`${n.userId}-${i}`} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <MemberLink userId={n.userId} name={n.name} />
                <p className="truncate text-xs text-neutral-500">
                  {n.title} · {n.currentLabel} / {n.targetLabel}
                </p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(n.progress * 100)}%` }} />
                </div>
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-neutral-700">
                {Math.round(n.progress * 100)}%
              </span>
            </Card>
          ))}
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Section title={t("coach.longestStreaks")} icon={<Flame className="size-4" />} empty={data.longestStreaks.length === 0} emptyLabel={emptyLabel}>
          <div className="flex flex-col gap-2">
            {data.longestStreaks.map((s) => (
              <Card key={s.userId} className="flex items-center justify-between gap-3 p-3">
                <MemberLink userId={s.userId} name={s.name} />
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                  <Flame className="size-3.5" /> {t("coach.days", { count: s.streakDays })}
                </span>
              </Card>
            ))}
          </div>
        </Section>

        <Section title={t("coach.mostActive")} icon={<Activity className="size-4" />} empty={data.mostActive.length === 0} emptyLabel={emptyLabel}>
          <div className="flex flex-col gap-2">
            {data.mostActive.map((a) => (
              <Card key={a.userId} className="flex items-center justify-between gap-3 p-3">
                <MemberLink userId={a.userId} name={a.name} />
                <span className="shrink-0 text-xs text-neutral-500">
                  {t.rich("coach.sessions", {
                    count: a.sessions,
                    b: (chunks) => <span className="font-semibold text-neutral-700">{chunks}</span>,
                  })}
                </span>
              </Card>
            ))}
          </div>
        </Section>
      </div>

      <Section title={t("coach.stale")} icon={<Clock className="size-4" />} empty={data.staleMembers.length === 0} emptyLabel={emptyLabel}>
        <div className="flex flex-col gap-2">
          {data.staleMembers.map((s) => (
            <Card key={s.userId} className="flex items-center justify-between gap-3 p-3">
              <MemberLink userId={s.userId} name={s.name} />
              <span className="shrink-0 text-xs text-neutral-500">
                {s.lastMilestoneAt
                  ? t("coach.daysAgo", { count: s.daysSince })
                  : t("coach.noMilestone")}
              </span>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}
