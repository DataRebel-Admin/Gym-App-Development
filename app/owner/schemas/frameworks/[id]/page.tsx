import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/staff";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ExerciseMultiSelect } from "@/components/owner/exercise-multiselect";
import { exerciseTypeOptions } from "@/lib/exercise-types";
import { saveFramework, deleteFramework } from "../actions";

export const metadata = { title: "Kader bewerken | Schema's" };

const num =
  "w-24 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent";
const text =
  "w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent";

function MinMax({
  label,
  minName,
  maxName,
  minVal,
  maxVal,
}: {
  label: string;
  minName: string;
  maxName: string;
  minVal: number | null;
  maxVal: number | null;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-neutral-700">
      <span className="w-40 shrink-0">{label}</span>
      <input
        name={minName}
        type="number"
        min={0}
        placeholder="min"
        defaultValue={minVal ?? ""}
        className={num}
      />
      <span className="text-neutral-400">–</span>
      <input
        name={maxName}
        type="number"
        min={0}
        placeholder="max"
        defaultValue={maxVal ?? ""}
        className={num}
      />
    </div>
  );
}

export default async function FrameworkEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const owner = await requirePermission("schemas:manage");

  const framework = await prisma.schemaFramework.findFirst({
    where: { id, tenantId: owner.tenantId },
  });
  if (!framework) notFound();

  const exercises = await prisma.exercise.findMany({
    where: { tenantId: owner.tenantId, archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, targetMuscle: true },
  });
  const typeOptions = exerciseTypeOptions();
  const allowedTypes = new Set(framework.allowedTypes);

  const requireApprovalValue =
    framework.requireApproval === true ? "yes" : framework.requireApproval === false ? "no" : "default";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/owner/schemas/frameworks"
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Kaders
        </Link>
        <h2 className="mt-2 text-lg font-semibold text-neutral-900">Kader bewerken</h2>
      </div>

      <form action={saveFramework} className="flex max-w-2xl flex-col gap-5">
        <input type="hidden" name="id" value={framework.id} />

        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Naam
          <input name="name" defaultValue={framework.name} required className={text} />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Omschrijving <span className="font-normal text-neutral-400">(optioneel)</span>
          <input
            name="description"
            defaultValue={framework.description ?? ""}
            maxLength={500}
            className={text}
          />
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
          <input
            type="checkbox"
            name="isDefault"
            defaultChecked={framework.isDefault}
            className="accent-[var(--tenant-accent)]"
          />
          Tenant-standaard (geldt voor leden zonder eigen kader)
        </label>

        <fieldset className="flex flex-col gap-2 rounded-xl border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-neutral-900">Grenzen</legend>
          <MinMax label="Aantal dagen" minName="minDays" maxName="maxDays" minVal={framework.minDays} maxVal={framework.maxDays} />
          <MinMax
            label="Oefeningen per dag"
            minName="minExercisesPerDay"
            maxName="maxExercisesPerDay"
            minVal={framework.minExercisesPerDay}
            maxVal={framework.maxExercisesPerDay}
          />
          <MinMax label="Sets per oefening" minName="setsMin" maxName="setsMax" minVal={framework.setsMin} maxVal={framework.setsMax} />
          <MinMax label="Herhalingen per set" minName="repsMin" maxName="repsMax" minVal={framework.repsMin} maxVal={framework.repsMax} />
          <MinMax label="Rust (seconden)" minName="restMin" maxName="restMax" minVal={framework.restMin} maxVal={framework.restMax} />
        </fieldset>

        <fieldset className="flex flex-col gap-2 rounded-xl border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-neutral-900">
            Toegestane oefeningstypes
          </legend>
          <p className="text-xs text-neutral-400">Niets aanvinken = alle types toegestaan.</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {typeOptions.map((t) => (
              <label key={t.value} className="flex items-center gap-1.5 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  name="allowedTypes"
                  value={t.value}
                  defaultChecked={allowedTypes.has(t.value)}
                  className="accent-[var(--tenant-accent)]"
                />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2 rounded-xl border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-neutral-900">
            Toegestane oefeningen
          </legend>
          <ExerciseMultiSelect
            name="allowedExerciseIds"
            options={exercises}
            initialSelected={framework.allowedExerciseIds}
          />
        </fieldset>

        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Goedkeuring vereist
          <select name="requireApproval" defaultValue={requireApprovalValue} className={text}>
            <option value="default">Volg sportschool-instelling</option>
            <option value="yes">Altijd goedkeuring vereist</option>
            <option value="no">Direct bruikbaar (geen goedkeuring)</option>
          </select>
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            Opslaan
          </button>
        </div>
      </form>

      <section className="flex max-w-2xl flex-col gap-2 rounded-2xl border border-red-200 p-5">
        <h3 className="text-sm font-semibold text-red-700">Verwijderen</h3>
        <ConfirmButton
          action={deleteFramework}
          fields={{ id: framework.id }}
          label="Kader verwijderen"
          triggerClassName="self-start rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          title="Kader verwijderen?"
          message="Weet je zeker dat je dit kader wilt verwijderen? Lid-koppelingen vervallen."
        />
      </section>
    </div>
  );
}
