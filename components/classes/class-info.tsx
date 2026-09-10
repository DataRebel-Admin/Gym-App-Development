"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Dropdown } from "@/components/ui/dropdown";
import { ChevronRight, Info } from "@/components/ui/icons";

/**
 * Info-knop bij een lestype: tikken opent een paneeltje met de omschrijving die
 * de sportschool bij de les heeft gezet (`GroupClass.description`).
 *
 * Bewust een klik en geen hover-tooltip: op een telefoon bestaat hover niet, en
 * de lessenlijst is mobile-first. `Dropdown` sluit al bij klik-buiten en
 * Escape; `closeOnBack` maakt de Android-terugknop een sluitknop (het paneel
 * navigeert nergens heen, dus die extra history-entry is onschadelijk).
 *
 * Zonder omschrijving rendert de knop niet: een icoon dat "geen informatie"
 * opent is ruis. De owner-vulling zit op /owner/rooster bij het aanmaken.
 *
 * LET OP: het paneel staat absoluut gepositioneerd, dus plaats deze knop nooit
 * in een `overflow-x-auto`-rij (zoals de filterchips) — die klipt hem weg.
 */
export function ClassInfoButton({
  name,
  description,
  align = "end",
  moreHref,
  moreLabel,
}: {
  name: string;
  description: string | null;
  align?: "start" | "end";
  /** Doorklik naar de lestype-pagina (beeld, instructeur, regels, momenten). */
  moreHref?: string;
  moreLabel?: string;
}) {
  const t = useTranslations("member.rooster");
  if (!description) return null;
  return (
    <Dropdown
      align={align}
      closeOnBack
      className="w-64 max-w-[calc(100vw-3rem)] p-3.5"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={t("infoAria", { name })}
          className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-colors active:bg-surface-2 ${
            open ? "bg-accent-soft text-accent" : "text-neutral-400 hover:text-accent"
          }`}
        >
          <Info className="size-4" />
        </button>
      )}
    >
      {({ close }) => (
        <div className="flex flex-col gap-1.5 text-left">
          <p className="font-display text-sm font-bold text-neutral-900">{name}</p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-600">{description}</p>
          {moreHref && moreLabel ? (
            // `keepHistory`: vanuit het paneel navigeren we weg, en een
            // history.back() vecht daar met de navigatie (zie CLAUDE.md).
            <Link
              href={moreHref}
              onClick={() => close({ keepHistory: true })}
              className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-accent"
            >
              {moreLabel} <ChevronRight className="size-3.5" />
            </Link>
          ) : null}
        </div>
      )}
    </Dropdown>
  );
}
