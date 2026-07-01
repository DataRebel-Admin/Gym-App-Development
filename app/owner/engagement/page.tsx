import Link from "next/link";
import { requirePermission } from "@/lib/staff";
import { prisma } from "@/lib/db";
import { listCoachMembers } from "@/lib/coach-assignments";
import { getCoachEngagement } from "@/lib/achievements/coach";
import { Card } from "@/components/ui/card";
import { CoachOverview } from "@/components/achievements/coach-overview";

export const metadata = { title: "Betrokkenheid" };

export default async function EngagementPage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string }>;
}) {
  const user = await requirePermission("members:view");
  const { mine } = await searchParams;
  const showMine = mine === "1";

  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { achievementsEnabled: true },
  });

  if (!tenant?.achievementsEnabled) {
    return (
      <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <header>
          <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900">Betrokkenheid</h1>
        </header>
        <Card className="p-8 text-center text-sm text-neutral-500">
          Het trofeeën- en mijlpalensysteem staat uit voor deze sportschool.
          {user.role === "TENANT_ADMIN" ? (
            <>
              {" "}
              <Link href="/owner/settings" className="text-accent hover:underline">
                Zet het aan in de instellingen →
              </Link>
            </>
          ) : null}
        </Card>
      </div>
    );
  }

  // Optioneel scopen op "mijn leden" (coach-koppeling).
  let memberIds: string[] | undefined;
  if (showMine) {
    const mineRows = await listCoachMembers(user.tenantId, user.id);
    memberIds = mineRows.map((m) => m.memberId);
  }

  const data = await getCoachEngagement(user.tenantId, memberIds ? { memberIds } : {});

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-neutral-900">Betrokkenheid</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Mijlpalen, streaks en activiteit van je leden — speel in op motivatie.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border bg-surface-1 p-1 text-sm">
          <Link
            href="/owner/engagement"
            className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
              showMine ? "text-neutral-600 hover:text-neutral-900" : "bg-accent-soft text-accent"
            }`}
          >
            Alle leden
          </Link>
          <Link
            href="/owner/engagement?mine=1"
            className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
              showMine ? "bg-accent-soft text-accent" : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Mijn leden
          </Link>
        </div>
      </header>

      <CoachOverview data={data} />
    </div>
  );
}
