import { getTranslations } from "next-intl/server";
import { getCurrentTenant } from "@/lib/tenant";
import { ResetShell } from "./reset-shell";
import { ResetRequestForm } from "./reset-request-form";

export async function generateMetadata() {
  const t = await getTranslations("auth.reset");
  return { title: t("title") };
}

export default async function ResetRequestPage() {
  const [tenant, t] = await Promise.all([
    getCurrentTenant(),
    getTranslations("auth.reset"),
  ]);

  return (
    <ResetShell
      logoUrl={tenant?.logoUrl}
      name={tenant?.name ?? "GymRebel"}
      title={t("title")}
      subtitle={t("subtitle")}
      backLabel={t("backToLogin")}
    >
      <ResetRequestForm />
    </ResetShell>
  );
}
