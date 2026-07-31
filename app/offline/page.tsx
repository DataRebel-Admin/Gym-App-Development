import { getTranslations } from "next-intl/server";
import { GymRebelMark } from "@/components/brand/gymrebel-logo";

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
      {/* Statische pagina zonder tenant-context → het platformmerk. */}
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <GymRebelMark className="w-10 h-auto" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold text-neutral-900">{t("title")}</h1>
        <p className="mx-auto max-w-sm text-sm text-neutral-500">{t("body")}</p>
      </div>
      {/* Bewust een kale <a>: deze pagina wordt offline uit de SW-cache geserveerd
          en moet een échte navigatie doen — <Link>-JS is er dan mogelijk niet. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/"
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        {tCommon("retry")}
      </a>
    </main>
  );
}
