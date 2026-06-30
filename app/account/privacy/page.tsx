import { getAccountUser } from "@/lib/account";
import { buttonClasses } from "@/components/ui/button-classes";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ConsentsForm } from "./privacy-form";
import { requestAccountDeletion } from "../actions";

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" });

export const metadata = { title: "Privacy" };

export default async function PrivacyPage() {
  const user = await getAccountUser();
  const consents =
    user.consents && typeof user.consents === "object"
      ? (user.consents as Record<string, boolean>)
      : null;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-2xl font-bold text-neutral-900">Privacy</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Beheer je gegevens en toestemmingen.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-surface-1 p-5">
        <ConsentsForm initial={consents} />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-1 p-5">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Je gegevens downloaden</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Exporteer al je accountgegevens (profiel, sessies, aanmeldingen) als JSON.
          </p>
        </div>
        <a href="/account/export" className={`${buttonClasses({ variant: "outline", size: "sm" })} self-start`}>
          ⬇ Exporteer mijn gegevens
        </a>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-surface-1 p-5">
        <div>
          <h2 className="text-sm font-semibold text-red-700">Account verwijderen</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Dien een verzoek in om je account te laten verwijderen. Een beheerder
            verwerkt dit; je kunt het verzoek tot die tijd annuleren.
          </p>
        </div>
        {user.deletionRequestedAt ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-700">
              Verzoek ingediend op {DATE_FMT.format(user.deletionRequestedAt)}
            </span>
            <form action={requestAccountDeletion}>
              <input type="hidden" name="cancel" value="true" />
              <button type="submit" className={buttonClasses({ variant: "outline", size: "sm" })}>
                Verzoek annuleren
              </button>
            </form>
          </div>
        ) : (
          <ConfirmButton
            action={requestAccountDeletion}
            label="Verwijdering aanvragen"
            confirmLabel="Verzoek indienen"
            title="Account verwijderen aanvragen?"
            message="Je dient een verwijderverzoek in. Een beheerder verwerkt dit; tot die tijd blijft je account werken en kun je het verzoek annuleren."
            triggerClassName={`${buttonClasses({ variant: "danger", size: "sm" })} self-start`}
          />
        )}
      </section>
    </div>
  );
}
