import { cn } from "@/lib/cn";
import type { AppLocale } from "@/lib/i18n/config";

/**
 * Kleine vlag-chip per taal als **inline-SVG** — bewust géén emoji: op Windows
 * (en delen van Linux) rendert een regional-indicator-emoji als de láttercode
 * ("NL", "GB"), waardoor Frysk óók als "NL" verscheen. SVG's zien er op elk OS
 * identiek en premium uit.
 *
 * Frysk krijgt de **officiële Fryske vlag** (blauw/wit diagonale banen met rode
 * pompeblêden) — er bestaat geen Frysk-emoji. De `<svg>`-viewport clipt zelf de
 * overlopende vormen, dus geen `clipPath`/ids nodig (veilig in RSC, geen hooks).
 */
export function LocaleFlag({
  code,
  className,
}: {
  code: AppLocale;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-6 shrink-0 overflow-hidden rounded-[3px] shadow-inner ring-1 ring-black/10",
        className,
      )}
      aria-hidden
    >
      {code === "nl" ? <FlagNL /> : code === "en" ? <FlagEN /> : <FlagFY />}
    </span>
  );
}

/** Nederland — horizontale tricolor. */
function FlagNL() {
  return (
    <svg viewBox="0 0 90 60" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <rect width="90" height="20" fill="#AE1C28" />
      <rect y="20" width="90" height="20" fill="#ffffff" />
      <rect y="40" width="90" height="20" fill="#21468B" />
    </svg>
  );
}

/** Verenigd Koninkrijk — vereenvoudigde Union Jack (chip-formaat). */
function FlagEN() {
  return (
    <svg viewBox="0 0 90 60" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <rect width="90" height="60" fill="#012169" />
      {/* Diagonalen: wit (St. Andrew) onder, rood (St. Patrick) dunner erbovenop */}
      <path d="M0 0 L90 60 M90 0 L0 60" stroke="#ffffff" strokeWidth="12" />
      <path d="M0 0 L90 60 M90 0 L0 60" stroke="#C8102E" strokeWidth="6" />
      {/* Kruis: wit onder, rood erbovenop (St. George) */}
      <path d="M45 0 V60 M0 30 H90" stroke="#ffffff" strokeWidth="18" />
      <path d="M45 0 V60 M0 30 H90" stroke="#C8102E" strokeWidth="10" />
    </svg>
  );
}

/**
 * Fryslân — 7 gelijke diagonale banen (4 blauw, 3 wit) van linksboven naar
 * rechtsonder, met 7 rode pompeblêden. De banen zijn horizontale stroken in een
 * `rotate(34)`-groep; de SVG-viewport clipt de overhang.
 *
 * De pompeblêden staan **rechtop** (niet meegekanteld met de banen) — elk blad
 * counter-roteert `-34`. De vorm is nagetekend van de aangeleverde pompeblêd
 * (rond lijf, grote lob linksboven, kleine lob rechts, inkeping ertussen), in een
 * eigen 500×500-tekenbox die per blad geschaald + gepositioneerd wordt. De blaadjes
 * zijn klein genoeg om **binnen de witte baan** te blijven en **raken elkaar niet**.
 * Opstelling 2-3-2: drie gespreid over de middelste witte baan (hoek-tot-hoek), en op
 * elke buitenste baan een paar (rechtsboven + linksonder), puntsymmetrisch om het midden.
 */
function FlagFY() {
  const blue = "#164FA3";
  const red = "#E12A24";
  // Pompeblêd in een 500×500-box (visueel midden ≈ 255,250). Eén schoon pad
  // zonder zelfkruising, nagetekend van de aangeleverde vorm.
  const pompeblad =
    "M30,225 C30,120 78,40 158,32 C220,26 262,34 282,58 " +
    "C296,100 284,158 270,202 C266,222 288,214 300,190 " +
    "C322,158 360,150 392,158 C452,172 480,205 478,248 " +
    "C474,350 388,470 248,470 C112,470 30,362 30,225 Z";
  // Middelpunten in groep-coördinaten (vóór de 34°-rotatie). Witte banen op
  // y = 1.4 / 30 / 58.6; leaves zitten centraal op die banen, ruim uit elkaar.
  const leaves = [
    { x: 13, y: 30 }, // middelste baan — linksboven-uiteinde
    { x: 45, y: 30 }, // middelste baan — midden
    { x: 77, y: 30 }, // middelste baan — rechtsonder-uiteinde
    { x: 49, y: 1.4 }, // bovenste baan — paar rechtsboven
    { x: 65, y: 1.4 },
    { x: 41, y: 58.6 }, // onderste baan — paar linksonder
    { x: 25, y: 58.6 },
  ];
  return (
    <svg viewBox="0 0 90 60" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <rect width="90" height="60" fill={blue} />
      <g transform="rotate(34 45 30)">
        {/* Drie witte banen (gelijke breedte, blauw is de achtergrond ertussen) */}
        <rect x="-60" y="-5.75" width="210" height="14.3" fill="#ffffff" />
        <rect x="-60" y="22.85" width="210" height="14.3" fill="#ffffff" />
        <rect x="-60" y="51.45" width="210" height="14.3" fill="#ffffff" />
        {/* Pompeblêden — rechtop (counter-rotate −34), geschaald in het wit */}
        {leaves.map((l, i) => (
          <path
            key={i}
            d={pompeblad}
            fill={red}
            transform={`translate(${l.x} ${l.y}) rotate(-34) scale(0.023) translate(-255 -250)`}
          />
        ))}
      </g>
    </svg>
  );
}
