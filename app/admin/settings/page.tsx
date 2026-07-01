import { requireSuperadmin } from "@/lib/superadmin";
import { getSupportEmail } from "@/lib/platform-settings";
import { SupportEmailForm } from "@/components/admin/support-email-form";

export const metadata = { title: "Instellingen" };

export default async function AdminSettingsPage() {
  await requireSuperadmin();
  const supportEmail = await getSupportEmail();

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Platforminstellingen
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Globale instellingen die voor alle sportscholen gelden.
        </p>
      </div>

      <section className="flex max-w-2xl flex-col gap-4 rounded-xl border border-border p-5">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Support &amp; contact</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Waar contactberichten van sportschooleigenaren naartoe gaan.
          </p>
        </div>
        <SupportEmailForm current={supportEmail} />
      </section>
    </div>
  );
}
