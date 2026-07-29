import { useTranslations } from "next-intl";

/**
 * Het verplichte "telt niet op"-label bij actieve-leden-cijfers naast
 * vestigingsrijen (zie lib/metrics/definitions.ts): zonder deze uitleg telt een
 * eigenaar de vestigingskolom zelf op en concludeert dat de cijfers niet
 * kloppen. Sync server component (useTranslations-idioom widget-bodies).
 */
export function NonAdditiveNote() {
  const t = useTranslations("owner.insights");
  return (
    <p className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-neutral-600">
      {t.rich("nonAdditiveNote", {
        b: (chunks) => <span className="font-semibold">{chunks}</span>,
      })}
    </p>
  );
}
