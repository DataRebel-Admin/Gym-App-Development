"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { exerciseTypeOptions } from "@/lib/exercise-types";
import { setExerciseType } from "./actions";

/**
 * Compacte, direct-opslaande type-keuze voor één oefening. Gebruikt op de
 * oefeningkaarten (eigen + catalogus) zodat de owner een (automatisch ingeschat)
 * type kan bijsturen zonder de oefening te openen.
 */
export function ExerciseTypeSelect({
  exerciseId,
  value,
}: {
  exerciseId: string;
  value: string;
}) {
  const router = useRouter();
  const t = useTranslations("owner.exercises");
  const [pending, start] = useTransition();

  return (
    <select
      aria-label={t("typeAria")}
      defaultValue={value}
      disabled={pending}
      onChange={(e) => {
        const fd = new FormData();
        fd.set("id", exerciseId);
        fd.set("exerciseType", e.target.value);
        start(async () => {
          await setExerciseType(fd);
          router.refresh();
        });
      }}
      className="max-w-[9rem] rounded-md border border-border bg-surface-1 px-1.5 py-1 text-xs text-neutral-700 outline-none focus:border-accent disabled:opacity-50"
    >
      {exerciseTypeOptions().map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
