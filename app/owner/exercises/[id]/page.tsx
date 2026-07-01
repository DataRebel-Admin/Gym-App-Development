import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenantUser } from "@/lib/staff";
import { getExerciseDetail } from "@/lib/exercise";
import { getCurrentTenant } from "@/lib/tenant";
import { isAiEnabled } from "@/lib/ai/enabled";
import { ExerciseDetailView } from "@/components/member/exercise-detail-view";
import { ExerciseAssistant } from "@/components/ai/exercise-assistant";
import { surfaceSuggestions } from "@/lib/ai";
import { ChevronLeft } from "@/components/ui/icons";
import { askExerciseAssistant } from "./ai-actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const [user, tenant] = await Promise.all([requireTenantUser(), getCurrentTenant()]);
  const detail = await getExerciseDetail(id, user.tenantId, tenant?.locale ?? "NL");
  return { title: detail ? `${detail.name} | Oefening` : "Oefening" };
}

/**
 * Read-only uitleg van een oefening voor tenant-gebruikers (owner/medewerker).
 * Hergebruikt de member-`ExerciseDetailView` (gif/stappen/spieren + veiligheids-
 * melding) zodat de coach exact ziet wat het lid te zien krijgt. Bereikbaar via de
 * "Uitleg"-link in de live-preview van de schema-editor. Alternatieven worden
 * bewust weggelaten (die linken naar member-routes).
 */
export default async function OwnerExerciseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, tenant] = await Promise.all([requireTenantUser(), getCurrentTenant()]);
  const detail = await getExerciseDetail(id, user.tenantId, tenant?.locale ?? "NL");
  if (!detail) notFound();

  // AI-oefeningassistent: alleen als de AI-module beschikbaar is (flag + owner-toggle).
  const aiEnabled = await isAiEnabled(user.tenantId);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-1 py-2">
      <Link
        href="/owner/exercises"
        className="inline-flex w-fit items-center gap-1 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900"
      >
        <ChevronLeft className="size-4" /> Oefeningen
      </Link>
      <ExerciseDetailView
        detail={detail}
        alternatives={[]}
        assistantSlot={
          aiEnabled ? (
            <ExerciseAssistant
              ask={askExerciseAssistant.bind(null, detail.id)}
              suggestions={surfaceSuggestions("exercise")}
            />
          ) : null
        }
      />
    </div>
  );
}
