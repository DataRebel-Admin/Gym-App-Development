import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCurrentTenant } from "@/lib/tenant";
import { resolvePasswordResetToken } from "@/lib/password-reset";
import { buttonClasses } from "@/components/ui/button";
import { ResetShell } from "../reset-shell";
import { ResetPasswordForm } from "./reset-password-form";

export async function generateMetadata() {
  const t = await getTranslations("auth.reset");
  return { title: t("newTitle") };
}

export default async function ResetTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [tenant, t, info] = await Promise.all([
    getCurrentTenant(),
    getTranslations("auth.reset"),
    resolvePasswordResetToken(token),
  ]);

  const name = tenant?.name ?? "GymRebel";

  // Ongeldige of verlopen token → nette uitleg + opnieuw aanvragen.
  if (!info) {
    return (
      <ResetShell
        logoUrl={tenant?.logoUrl}
        name={name}
        title={t("invalidTitle")}
        subtitle={t("invalidBody")}
        backLabel={t("backToLogin")}
      >
        <Link
          href="/login/reset"
          className={buttonClasses({ size: "lg", className: "w-full" })}
        >
          {t("requestNew")}
        </Link>
      </ResetShell>
    );
  }

  return (
    <ResetShell
      logoUrl={tenant?.logoUrl}
      name={name}
      title={t("newTitle")}
      subtitle={t("newSubtitle", { email: info.email })}
      backLabel={t("backToLogin")}
    >
      <ResetPasswordForm token={token} />
    </ResetShell>
  );
}
