import { requireSuperadmin } from "@/lib/superadmin";
import { SectionHeading } from "@/components/ui/section-heading";
import { ChangelogTimeline } from "@/components/changelog/changelog-timeline";

export const metadata = { title: "Wijzigingslogboek" };

export default async function AdminChangelogPage() {
  // Platformbreed changelog — zelfde bron als de owner-weergave, maar hier voor
  // de superadmin. `requireSuperadmin` dwingt de rol af (proxy + guard).
  await requireSuperadmin();

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <SectionHeading
        title="Wijzigingslogboek"
        description="Nieuwe functies en verbeteringen in GymRebel — het platformbrede releaseoverzicht."
      />
      <ChangelogTimeline />
    </div>
  );
}
