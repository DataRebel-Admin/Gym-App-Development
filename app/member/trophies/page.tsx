import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/member";
import {
  evaluateAndAward,
  getAchievementsView,
  getAchievementUiState,
} from "@/lib/achievements/evaluate";
import { RARITIES } from "@/lib/achievements/rarity";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { ProgressRing } from "@/components/ui/progress-ring";
import { EmptyState } from "@/components/ui/empty-state";
import { Trophy, ChevronRight, BookOpen, Sparkles } from "@/components/ui/icons";
import { AchievementCard } from "@/components/achievements/achievement-card";
import { AchievementBadge } from "@/components/achievements/achievement-badge";

export const metadata = { title: "Trofeeën" };

export default async function TrophiesPage() {
  const member = await requireMember();
  const { enabled } = await getAchievementUiState(member.id, member.tenantId);
  if (!enabled) redirect("/member");

  // Lazy evaluatie: vang mijlpalen die niet aan een training hangen (lidmaatschap-
  // duur, profiel compleet, …). Idempotent — kent alleen nieuw behaalde toe.
  await evaluateAndAward(member.id, member.tenantId, { actor: { id: member.id, email: member.email } });

  const view = await getAchievementsView(member.id, member.tenantId);

  const overallPct = view.totalCount > 0 ? Math.round((view.earnedCount / view.totalCount) * 100) : 0;

  return (
    <Reveal stagger className="flex flex-1 flex-col gap-5 px-5 py-7">
      {/* Hero */}
      <RevealItem className="panel-sheen relative overflow-hidden rounded-3xl bg-accent-gradient p-6 text-accent-foreground shadow-accent">
        <div aria-hidden className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-white/15 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <ProgressRing
            value={overallPct}
            size={96}
            strokeWidth={9}
            label={`${view.earnedCount}`}
            sublabel={`van ${view.totalCount}`}
          />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">Trainingsniveau</p>
            <p className="mt-0.5 font-display text-2xl font-bold">{view.level.name}</p>
            <p className="mt-0.5 text-sm opacity-90">
              {view.earnedCount === 0
                ? "Behaal je eerste trofee!"
                : `${view.earnedCount} trofee${view.earnedCount === 1 ? "" : "ën"} behaald`}
            </p>
          </div>
        </div>
      </RevealItem>

      {/* Zeldzaamheid-verdeling */}
      <RevealItem className="grid grid-cols-6 gap-2 rounded-3xl border border-border bg-surface-1 p-4 shadow-sm">
        {RARITIES.map((r) => (
          <div key={r.key} className="flex flex-col items-center gap-1">
            <span className={`flex size-8 items-center justify-center rounded-full ${r.gradient}`}>
              <Trophy className={`size-4 ${r.onGradient}`} />
            </span>
            <span className="text-sm font-bold tabular-nums text-neutral-900">
              {view.rarityCounts[r.key]}
            </span>
            <span className="text-[9px] font-medium uppercase tracking-wide text-neutral-400">
              {r.label}
            </span>
          </div>
        ))}
      </RevealItem>

      {/* Gym Passport-link */}
      <RevealItem>
        <Link
          href="/member/passport"
          className="flex items-center gap-3 rounded-2xl border border-border bg-surface-1 p-4 shadow-sm active:scale-[0.99]"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <BookOpen className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display font-bold text-neutral-900">Gym Passport</span>
            <span className="block text-sm text-neutral-500">Jouw persoonlijke logboek met mijlpalen</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-neutral-300" />
        </Link>
      </RevealItem>

      {/* Bijna behaald */}
      {view.nextUp.length > 0 ? (
        <RevealItem className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Sparkles className="size-4 text-accent" /> Bijna behaald
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {view.nextUp.slice(0, 3).map((item) => (
              <AchievementCard key={item.def.key} item={item} />
            ))}
          </div>
        </RevealItem>
      ) : null}

      {/* Categorieën */}
      {view.byCategory.map((cat) => (
        <RevealItem key={cat.category} className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-neutral-900">
              <cat.meta.icon className="size-5 text-accent" /> {cat.meta.label}
            </h2>
            <span className="text-xs font-medium tabular-nums text-neutral-400">
              {cat.earnedCount}/{cat.items.length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {cat.items.map((item) => (
              <AchievementCard key={item.def.key} item={item} />
            ))}
          </div>
        </RevealItem>
      ))}

      {view.earnedCount === 0 && view.nextUp.length === 0 ? (
        <RevealItem>
          <EmptyState
            icon={<Trophy className="size-7 text-accent" />}
            title="Nog geen trofeeën"
            description="Start je eerste training om trofeeën te verdienen."
          />
        </RevealItem>
      ) : null}

      <RevealItem className="flex items-center justify-center gap-2 pt-1 text-center text-xs text-neutral-400">
        <AchievementBadge icon={Trophy} rarity="gold" earned size="sm" />
        Blijf trainen en verzamel ze allemaal
      </RevealItem>
    </Reveal>
  );
}
