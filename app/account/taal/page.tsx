import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { AccountPageHeader } from "@/components/account/account-page-header";

export async function generateMetadata() {
  const t = await getTranslations("account.language");
  return { title: t("title") };
}

export default async function LanguagePage() {
  const t = await getTranslations("account.language");

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <AccountPageHeader title={t("title")} description={t("description")} />

      <section className="rounded-2xl border border-border bg-surface-1 p-5">
        <LanguageSwitcher variant="settings" />
      </section>
    </div>
  );
}
