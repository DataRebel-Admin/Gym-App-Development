import { prisma } from "@/lib/db";
import { requireAccount } from "@/lib/account";
import { parseTrainingGoals } from "@/lib/training-goals";
import { TrainingGoalsPicker } from "@/components/account/training-goals-picker";
import { AccountPageHeader } from "@/components/account/account-page-header";

export const metadata = { title: "Mijn doelen" };

export default async function TrainingGoalsPage() {
  const me = await requireAccount();
  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: { trainingGoals: true },
  });
  const initial = parseTrainingGoals(user?.trainingGoals);

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <AccountPageHeader
        title="Mijn doelen"
        description="Waar wil jij aan werken? Kies één of meer doelen — we stemmen je ervaring hierop af. Je kunt dit altijd aanpassen."
      />

      <section className="rounded-2xl border border-border bg-surface-1 p-5">
        <TrainingGoalsPicker initial={initial} />
      </section>
    </div>
  );
}
