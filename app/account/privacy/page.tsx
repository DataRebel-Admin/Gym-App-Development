import { getAccountUser } from "@/lib/account";
import { buttonClasses } from "@/components/ui/button-classes";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ConsentsForm } from "./privacy-form";
import { AccountPageHeader } from "@/components/account/account-page-header";
import { requestAccountDeletion } from "../actions";
import { ACCOUNT_DELETION_GRACE_DAYS } from "@/lib/constants";

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" });

export const metadata = { title: "Privacy" };

export default async function PrivacyPage() {
  const user = await getAccountUser();
  const consents =
    user.consents && typeof user.consents === "object"
      ? (user.consents as Record<string, boolean>)
      : null;

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <AccountPageHeader title="Privacy" description="Beheer je gegevens en toestemmingen." />

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
        <a href="/account/export" className={`${buttonClasses({ variant: "outline" })} self-start`}>
          ⬇ Exporteer mijn gegevens
        </a>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-surface-1 p-5">
        <div>
          <h2 className="text-sm font-semibold text-red-700">Account verwijderen</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Verwijder je account zelf. Na een bedenktijd van {ACCOUNT_DELETION_GRACE_DAYS} dagen
            worden je account en persoonlijke gegevens (sessies, prestaties, metingen, doelen,
            toegangssleutels) automatisch en definitief verwijderd. Je kunt tot die datum annuleren.
          </p>
        </div>
        {user.deletionRequestedAt ? (
          (() => {
            const deleteOn = new Date(
              user.deletionRequestedAt.getTime() +
                ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000
            );
            return (
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-700">
                  Wordt definitief verwijderd op {DATE_FMT.format(deleteOn)}
                </span>
                <form action={requestAccountDeletion}>
                  <input type="hidden" name="cancel" value="true" />
                  <button type="submit" className={buttonClasses({ variant: "outline" })}>
                    Verwijdering annuleren
                  </button>
                </form>
              </div>
            );
          })()
        ) : (
          <ConfirmButton
            action={requestAccountDeletion}
            label="Mijn account verwijderen"
            confirmLabel="Definitief verwijderen"
            title="Account verwijderen?"
            message={`Je account en persoonlijke gegevens worden na ${ACCOUNT_DELETION_GRACE_DAYS} dagen automatisch en definitief verwijderd (sessies, prestaties, metingen, doelen, toegangssleutels). Je kunt dit tot die datum annuleren; daarna is het onomkeerbaar.`}
            triggerClassName={`${buttonClasses({ variant: "danger" })} self-start`}
          />
        )}
      </section>
    </div>
  );
}
