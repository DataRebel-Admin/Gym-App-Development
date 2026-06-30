import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";

export async function generateMetadata() {
  const t = await getTranslations("account.language");
  return { title: t("title") };
}

export default async function LanguagePage() {
  const t = await getTranslations("account.language");

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-2xl font-bold text-neutral-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-neutral-500">{t("description")}</p>
      </header>

      <section className="rounded-2xl border border-border bg-surface-1 p-5">
        <LanguageSwitcher variant="settings" />
      </section>
    </div>
  );
}
