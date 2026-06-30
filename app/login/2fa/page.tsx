import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { TwoFactorForm } from "./two-factor-form";
import { getCurrentTenant } from "@/lib/tenant";
import { parseLoginChallenge } from "@/lib/login-challenge";
import { TWO_FACTOR_CHALLENGE_COOKIE } from "@/lib/constants";

export async function generateMetadata() {
  const t = await getTranslations("auth.twoFactor");
  return { title: t("title") };
}

export default async function TwoFactorPage() {
  // Zonder geldige challenge hoort niemand hier — terug naar de login.
  const challenge = (await cookies()).get(TWO_FACTOR_CHALLENGE_COOKIE)?.value;
  if (!challenge || !parseLoginChallenge(challenge)) redirect("/login");

  const [tenant, t] = await Promise.all([
    getCurrentTenant(),
    getTranslations("auth.twoFactor"),
  ]);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface-1 p-8 shadow-md">
        <div className="mb-8 text-center">
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt=""
              className="mx-auto mb-4 h-12 w-12 rounded-xl object-contain"
            />
          ) : (
            <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-accent-gradient text-lg font-bold text-accent-foreground shadow-accent">
              {(tenant?.name ?? "G").charAt(0)}
            </span>
          )}
          <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{t("subtitle")}</p>
        </div>

        <TwoFactorForm />

        <p className="mt-4 text-center text-xs text-neutral-500">
          <Link href="/login" className="font-medium hover:text-neutral-900">
            {t("backToLogin")}
          </Link>
        </p>
      </div>
    </main>
  );
}
