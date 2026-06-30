import Link from "next/link";
import { requirePermission } from "@/lib/staff";
import { blobConfigured } from "@/lib/blob";
import { CustomExerciseForm } from "../custom-exercise-form";

export const metadata = { title: "Nieuwe oefening | Eigen" };

export default async function NewCustomExercisePage() {
  await requirePermission("exercises:manage");

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/owner/exercises?tab=eigen"
        className="text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Eigen oefeningen
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Nieuwe eigen oefening
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Deze oefening is alleen zichtbaar binnen jouw sportschool en direct
          beschikbaar in de schema-editor.
        </p>
      </div>
      <CustomExerciseForm blobEnabled={blobConfigured()} />
    </div>
  );
}
