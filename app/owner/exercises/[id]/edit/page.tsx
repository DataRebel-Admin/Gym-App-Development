import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { blobConfigured } from "@/lib/blob";
import {
  CustomExerciseForm,
  type CustomExerciseFormData,
} from "../../custom-exercise-form";
import { DeleteCustomExercise } from "./delete-section";

async function loadExercise(id: string, tenantId: string) {
  return prisma.exercise.findFirst({
    where: { id, tenantId, catalogId: null },
    select: {
      id: true,
      name: true,
      description: true,
      targetMuscle: true,
      muscleGroups: true,
      category: true,
      difficulty: true,
      equipment: true,
      tags: true,
      executionMd: true,
      coachingTipsMd: true,
      commonMistakesMd: true,
      notesMd: true,
      imageUrls: true,
      videoUrl: true,
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const owner = await requireOwner();
  const ex = await loadExercise(id, owner.tenantId);
  return { title: ex ? `${ex.name} | Eigen` : "Oefening | Eigen" };
}

export default async function EditCustomExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const owner = await requireOwner();
  const ex = await loadExercise(id, owner.tenantId);
  if (!ex) notFound();

  const formData: CustomExerciseFormData = { ...ex };

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
          Oefening bewerken
        </h1>
        <p className="mt-1 text-sm text-neutral-500">{ex.name}</p>
      </div>

      <CustomExerciseForm exercise={formData} blobEnabled={blobConfigured()} />

      <section className="flex max-w-2xl flex-col gap-3 rounded-2xl border border-red-200 p-5">
        <h2 className="text-sm font-semibold text-red-700">Verwijderen</h2>
        <p className="text-sm text-neutral-500">
          Verwijderen kan alleen als de oefening nergens in een schema of
          trainingshistorie wordt gebruikt. Gebruik anders &quot;Archiveren&quot;.
        </p>
        <DeleteCustomExercise id={ex.id} />
      </section>
    </div>
  );
}
