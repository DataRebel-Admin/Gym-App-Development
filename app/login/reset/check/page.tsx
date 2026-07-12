import { getTranslations } from "next-intl/server";
import { getCurrentTenant } from "@/lib/tenant";
import { ResetShell } from "../reset-shell";

export async function generateMetadata() {
  const t = await getTranslations("auth.reset.check");
  return { title: t("title") };
}

export default async function ResetCheckPage() {
  const [tenant, t] = await Promise.all([
    getCurrentTenant(),
    getTranslations("auth.reset.check"),
  ]);

  return (
    <ResetShell
      logoUrl={tenant?.logoUrl}
      name={tenant?.name ?? "GymRebel"}
      title={t("title")}
      subtitle={t("description")}
      backLabel={t("backToLogin")}
    >
      <p className="rounded-lg bg-neutral-100 px-4 py-3 text-center text-xs text-neutral-500">
        {t("devNote")}
      </p>
    </ResetShell>
  );
}
