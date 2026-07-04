import { requireOwner } from "@/lib/owner";
import { SectionHeading } from "@/components/ui/section-heading";
import { ChangelogTimeline } from "@/components/changelog/changelog-timeline";

export const metadata = { title: "Wijzigingslogboek" };

export default async function ChangelogPage() {
  // Alleen de tenant-admin (eigenaar): `requireOwner` is admin-only. Medewerkers
  // krijgen een 403 en zien het item ook niet in de navigatie.
  await requireOwner();

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <SectionHeading
        title="Wijzigingslogboek"
        description="Nieuwe functies en verbeteringen in GymRebel — alleen zichtbaar voor jou als eigenaar."
      />
      <ChangelogTimeline />
    </div>
  );
}
