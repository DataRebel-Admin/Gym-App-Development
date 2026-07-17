import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("errors.offline");
  return { title: t("metaTitle") };
}

/**
 * Statische offline-fallback. De service worker precachet deze pagina en toont
 * 'm wanneer een navigatie faalt zonder verbinding. Bewust **zonder** tenant-
 * of auth-data zodat 'ie altijd (ook volledig offline) rendert.
 *
 * Let op: `sw.js` precachet deze pagina één keer bij install, dus de gecachete
 * kopie staat in de taal die op dát moment gold. Wisselt de gebruiker later van
 * taal, dan blijft de offline-pagina in de oude taal tot de cacheversie (`CACHE`
 * in sw.js) opgehoogd wordt. Bewuste afweging: één statische fallback is meer
 * waard dan een per-taal-variant die offline alsnog kan ontbreken.
 */
export default async function OfflinePage() {
  const [t, tCommon] = await Promise.all([
    getTranslations("errors.offline"),
    getTranslations("common"),
  ]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <svg viewBox="0 0 512 512" width="34" height="34" fill="currentColor" aria-hidden="true">
          <rect x="150" y="240" width="212" height="32" rx="16" />
          <rect x="160" y="214" width="24" height="84" rx="10" />
          <rect x="328" y="214" width="24" height="84" rx="10" />
          <rect x="116" y="190" width="34" height="132" rx="16" />
          <rect x="362" y="190" width="34" height="132" rx="16" />
        </svg>
      </div>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold text-neutral-900">{t("title")}</h1>
        <p className="mx-auto max-w-sm text-sm text-neutral-500">{t("body")}</p>
      </div>
      <a
        href="/"
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        {tCommon("retry")}
      </a>
    </main>
  );
}
