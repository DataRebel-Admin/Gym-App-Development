import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/member";
import { getAchievementUiState } from "@/lib/achievements/evaluate";
import { buildPassport } from "@/lib/achievements/passport";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { ChevronLeft, BookOpen } from "@/components/ui/icons";
import { PassportStamp } from "@/components/achievements/passport-stamp";

export const metadata = { title: "Gym Passport" };

export default async function PassportPage() {
  const member = await requireMember();
  const { enabled } = await getAchievementUiState(member.id, member.tenantId);
  if (!enabled) redirect("/member");

  const passport = await buildPassport(member.id, member.tenantId);
  const earnedStamps = passport.stamps.filter((s) => s.earned).length;
  const firstName = member.name?.split(" ")[0] ?? "Sporter";

  return (
    <Reveal stagger className="flex flex-1 flex-col gap-5 px-5 py-7">
      <RevealItem>
        <Link href="/member/trophies" className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500">
          <ChevronLeft className="size-4" /> Trofeeën
        </Link>
      </RevealItem>

      {/* Paspoort-kaft */}
      <RevealItem className="panel-sheen relative overflow-hidden rounded-3xl border border-amber-200/60 bg-gradient-to-br from-neutral-900 to-neutral-800 p-6 text-white shadow-xl">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative flex items-center gap-2 text-amber-300">
          <BookOpen className="size-5" />
          <span className="text-xs font-bold uppercase tracking-[0.3em]">Gym Passport</span>
        </div>
        <p className="relative mt-4 font-display text-2xl font-bold">{firstName}</p>
        <p className="relative mt-1 text-sm text-white/70">Lid sinds {passport.memberSinceLabel} · {earnedStamps}/{passport.stamps.length} stempels</p>
      </RevealItem>

      {/* Levensfeiten */}
      <RevealItem className="grid grid-cols-2 gap-3">
        {passport.facts.map((f) => (
          <div key={f.key} className="rounded-2xl border border-border bg-surface-1 p-4 shadow-sm">
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">
              <f.icon className="size-3.5" /> {f.label}
            </span>
            <p className="mt-1 font-display text-lg font-bold text-neutral-900">{f.value}</p>
          </div>
        ))}
      </RevealItem>

      {/* Stempels */}
      <RevealItem className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold text-neutral-900">Mijlpaalstempels</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {passport.stamps.map((stamp) => (
            <PassportStamp key={stamp.def.key} stamp={stamp} />
          ))}
        </div>
      </RevealItem>

      <RevealItem className="pt-1 text-center text-xs text-neutral-400">
        Elke mijlpaal die je bereikt, wordt hier vereeuwigd.
      </RevealItem>
    </Reveal>
  );
}
