import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("auth.check");
  return { title: t("title") };
}

export default async function CheckEmailPage() {
  const t = await getTranslations("auth.check");
  return (
    <main className="flex flex-1 items-center justify-center px-6 text-center">
      <div className="max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          {t("title")}
        </h1>
        <p className="mt-3 text-sm text-neutral-500">{t("description")}</p>
        <p className="mt-4 rounded-lg bg-neutral-100 px-4 py-3 text-xs text-neutral-500">
          {t("devNote")}
        </p>
      </div>
    </main>
  );
}
